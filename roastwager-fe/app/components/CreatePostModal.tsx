"use client";

import { useEffect, useRef, useState } from "react";
import { Image as ImageIcon, X } from "lucide-react";
import Image from "next/image";
import { useQueryClient } from "@tanstack/react-query";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import { BaseError } from "viem";
import { roastWagerAbi } from "@/lib/roastWagerAbi";
import { requireRoastWagerAddress } from "@/lib/contracts";
import { refreshRoastWagerQueries } from "@/lib/query-sync";
import { useOptimisticRoastWager } from "@/lib/optimistic-roastwager";

type Props = {
  open: boolean;
  onClose: () => void;
};

const MAX_CHAR = 280;
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL?.trim() || "http://localhost:3001";

export default function CreatePostModal({ open, onClose }: Props) {
  const [content, setContent] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [translateY, setTranslateY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [status, setStatus] = useState<string>("");
  const [error, setError] = useState<string>("");
  const startY = useRef(0);
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const queryClient = useQueryClient();
  const { addPendingPost } = useOptimisticRoastWager();
  const { writeContractAsync, isPending } = useWriteContract();

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "auto";

    return () => {
      document.body.style.overflow = "auto";
    };
  }, [open]);

  if (!open) return null;

  const resetState = () => {
    setTranslateY(0);
    setIsDragging(false);
    setStatus("");
    setError("");
    setContent("");
    setImage(null);
    setImageFile(null);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleSubmit = async () => {
    if (!content.trim()) return;
    if (!isConnected || !address) {
      setError("Connect your wallet first.");
      return;
    }
    if (!publicClient) {
      setError("Public client is not ready.");
      return;
    }

    try {
      setError("");
      let imageUrl = "";

      if (imageFile) {
        setStatus("Uploading image to Pinata...");
        const uploadBody = new FormData();
        uploadBody.append("file", imageFile);

        const uploadResponse = await fetch(`${API_BASE_URL}/api/uploads/pinata`, {
          method: "POST",
          body: uploadBody,
        });

        const uploadPayload = (await uploadResponse.json()) as {
          url?: string;
          error?: string;
        };

        if (!uploadResponse.ok || !uploadPayload.url) {
          throw new Error(uploadPayload.error || "Image upload failed");
        }

        imageUrl = uploadPayload.url;
      }

      setStatus("Waiting for wallet confirmation...");
      const hash = await writeContractAsync({
        address: requireRoastWagerAddress(),
        abi: roastWagerAbi,
        functionName: "createWager",
        args: [content.trim(), imageUrl],
      });

      setStatus("Transaction submitted. Waiting for confirmation...");
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") {
        throw new Error("Create wager transaction reverted");
      }

      addPendingPost({
        id: `pending:${hash}`,
        ownerAddress: address,
        address,
        level: null,
        content: content.trim(),
        imageUrl: imageUrl || image,
        timeLeft: "24h 0m",
        myVote: null,
        status: "active",
        winningSide: null,
        bullPool: null,
        bearPool: null,
        bullCount: null,
        bearCount: null,
        createdAt: Math.floor(Date.now() / 1000).toString(),
        isPending: true,
      });

      setStatus("Confirmed. Waiting for backend sync...");
      await refreshRoastWagerQueries(queryClient, address);
      handleClose();
    } catch (submitError) {
      const message =
        submitError instanceof BaseError
          ? submitError.shortMessage || submitError.message
          : submitError instanceof Error
            ? submitError.message
            : "Failed to create wager";
      setError(message);
      setStatus("");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div
        onClick={handleClose}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        style={{
          opacity: 1 - translateY / 300,
        }}
      />

      <div
        className="relative flex h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border border-[var(--border-soft)] bg-[var(--bg-main)]"
        style={{
          transform: `translateY(${translateY}px)`,
          transition: isDragging ? "none" : "transform 0.25s ease",
        }}
      >
        <div
          className="flex w-full cursor-grab justify-center py-2 active:cursor-grabbing"
          onTouchStart={(e) => {
            startY.current = e.touches[0].clientY;
            setIsDragging(true);
          }}
          onTouchMove={(e) => {
            if (!isDragging) return;

            const diff = e.touches[0].clientY - startY.current;
            if (diff > 0) setTranslateY(diff);
          }}
          onTouchEnd={() => {
            setIsDragging(false);

            if (translateY > 120) {
              handleClose();
            } else {
              setTranslateY(0);
            }
          }}
        >
          <div className="h-[2px] w-8 rounded-full bg-gray-400/40" />
        </div>

        <div className="flex items-center justify-between border-b border-[var(--border-soft)] px-4 py-3">
          <button onClick={handleClose} className="text-sm text-gray-400 hover:text-white">
            Cancel
          </button>

          <p className="font-bold text-[var(--text-main)]">Create Post</p>

          <button
            disabled={!content.trim() || isPending}
            onClick={handleSubmit}
            className="text-sm font-bold text-[var(--primary-soft)] disabled:opacity-40"
          >
            {isPending ? "Pending" : "Post"}
          </button>
        </div>

        <div className="flex-1 px-4 py-4">
          <textarea
            value={content}
            onChange={(e) => {
              setContent(e.target.value.slice(0, MAX_CHAR));
              e.target.style.height = "auto";
              e.target.style.height = `${e.target.scrollHeight}px`;
            }}
            placeholder="What's your hot take?"
            className="w-full resize-none overflow-hidden bg-transparent text-lg text-white outline-none placeholder:text-gray-500"
            rows={1}
          />

          <div className="mb-3 mt-1 text-right text-xs text-gray-500">
            {content.length}/{MAX_CHAR}
          </div>

          {image && (
            <div className="relative h-64">
              <Image
                src={image}
                alt="Preview"
                fill
                unoptimized
                className="rounded-2xl object-cover"
              />

              <button
                onClick={() => {
                  setImage(null);
                  setImageFile(null);
                }}
                className="absolute right-2 top-2 rounded-full bg-black/60 p-1"
              >
                <X size={14} />
              </button>
            </div>
          )}

          {(status || error) && (
            <div className="mt-4 rounded-xl border border-[var(--border-soft)] bg-[var(--bg-card)] p-3 text-sm">
              {status && <p className="text-[var(--text-main)]">{status}</p>}
              {error && <p className="text-red-300">{error}</p>}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-[var(--border-soft)] px-4 py-3">
          <label
            htmlFor="imageUpload"
            className="flex cursor-pointer items-center gap-2 text-sm text-[var(--primary-soft)]"
          >
            <ImageIcon size={18} />
            Add Image
          </label>

          <input
            type="file"
            accept="image/*"
            id="imageUpload"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setImage(URL.createObjectURL(file));
              setImageFile(file);
            }}
          />
        </div>
      </div>
    </div>
  );
}
