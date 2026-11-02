import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const rawPath = req.nextUrl.searchParams.get("path") || "";
    if (!rawPath) {
      return new NextResponse("Missing path", { status: 400 });
    }

    const resolvedPath = path.resolve(rawPath);
    const ext = path.extname(resolvedPath).toLowerCase();
    if (![".png", ".jpg", ".jpeg", ".webp"].includes(ext)) {
      return new NextResponse("Invalid image extension", { status: 400 });
    }

    if (!fs.existsSync(resolvedPath)) {
      return new NextResponse("Image not found on filesystem", { status: 404 });
    }

    const buffer = fs.readFileSync(resolvedPath);
    const mimeType =
      ext === ".jpg" || ext === ".jpeg"
        ? "image/jpeg"
        : ext === ".webp"
        ? "image/webp"
        : "image/png";

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": mimeType,
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch {
    return new NextResponse("Error reading image from filesystem", {
      status: 500,
    });
  }
}
