"use client";

import dynamic from "next/dynamic";

const ClientShell = dynamic(() => import("./client-shell"), { ssr: false });

export default ClientShell;
