// Used by release.bat to verify a release actually deployed to Vercel,
// the same way backend's /health echoes VERSION for the same purpose.
import fs from 'fs'
import path from 'path'
import { NextResponse } from 'next/server'

export async function GET() {
  let version = 'unknown'
  try {
    version = fs.readFileSync(path.join(process.cwd(), 'VERSION'), 'utf8').trim()
  } catch {
    // VERSION missing — leave as 'unknown' rather than failing the request
  }
  return NextResponse.json({ version })
}
