import { Hono } from 'hono'

const MAX_FILE_SIZE = 10 * 1024 * 1024

type V3UploadResponse = {
  data?: {
    cid?: string
  }
  error?: unknown
}

type LegacyUploadResponse = {
  IpfsHash?: string
  error?: unknown
}

function buildGatewayUrl(cid: string): string {
  const gatewayDomain = process.env.PINATA_GATEWAY_DOMAIN?.trim()
  const gatewayToken = process.env.PINATA_GATEWAY_ACCESS_TOKEN?.trim()

  if (!gatewayDomain) {
    return `https://gateway.pinata.cloud/ipfs/${cid}`
  }

  const baseUrl = `https://${gatewayDomain}/ipfs/${cid}`
  return gatewayToken ? `${baseUrl}?pinataGatewayToken=${encodeURIComponent(gatewayToken)}` : baseUrl
}

export const uploadsRouter = new Hono()

uploadsRouter.post('/pinata', async (c) => {
  const jwt = process.env.PINATA_JWT
  const apiKey = process.env.PINATA_API_KEY
  const apiSecret = process.env.PINATA_API_SECRET

  if (!jwt && (!apiKey || !apiSecret)) {
    return c.json({ error: 'Pinata credentials are missing' }, 500)
  }

  const formData = await c.req.raw.formData()
  const file = formData.get('file')

  if (!(file instanceof File)) {
    return c.json({ error: 'File is required' }, 400)
  }

  if (!file.type.startsWith('image/')) {
    return c.json({ error: 'Only image uploads are supported' }, 400)
  }

  if (file.size > MAX_FILE_SIZE) {
    return c.json({ error: 'Image must be 10MB or smaller' }, 400)
  }

  const upstream = new FormData()
  upstream.append('file', file)
  upstream.append('network', 'public')
  upstream.append('name', file.name || `roastwager-${Date.now()}`)

  let cid: string | undefined
  let failureStatus = 500
  let failureDetails: unknown

  if (jwt) {
    const response = await fetch('https://uploads.pinata.cloud/v3/files', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${jwt}`,
      },
      body: upstream,
    })

    const payload = (await response.json()) as V3UploadResponse
    cid = payload.data?.cid

    if (!response.ok || !cid) {
      failureStatus = response.status || 500
      failureDetails = payload.error ?? payload
    }
  }

  if (!cid && apiKey && apiSecret) {
    const legacyBody = new FormData()
    legacyBody.append('file', file)

    const legacyResponse = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
      method: 'POST',
      headers: {
        pinata_api_key: apiKey,
        pinata_secret_api_key: apiSecret,
      },
      body: legacyBody,
    })

    const legacyPayload = (await legacyResponse.json()) as LegacyUploadResponse
    cid = legacyPayload.IpfsHash

    if (!legacyResponse.ok || !cid) {
      failureStatus = legacyResponse.status || failureStatus
      failureDetails = legacyPayload.error ?? legacyPayload ?? failureDetails
    }
  }

  if (!cid) {
    return c.json(
      {
        error: 'Pinata upload failed',
        details: failureDetails,
        upstreamStatus: failureStatus,
      },
      502,
    )
  }

  return c.json({
    cid,
    url: buildGatewayUrl(cid),
  })
})
