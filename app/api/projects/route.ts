import { NextRequest, NextResponse } from "next/server";

const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL || "http://localhost:8787";

// GET - Fetch all projects (proxy to Cloudflare Worker)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const url = new URL("/api/projects", WORKER_URL);

    // Forward query params
    searchParams.forEach((value, key) => {
      url.searchParams.set(key, value);
    });

    const response = await fetch(url.toString());

    // Check if response is JSON before parsing
    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      console.error("Non-JSON response from worker:", await response.text());
      return NextResponse.json(
        { success: false, error: "Worker returned invalid response", projects: [] },
        { status: 500 }
      );
    }

    const data = await response.json();

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("Error fetching projects:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch projects", projects: [] },
      { status: 500 }
    );
  }
}

// POST - Create a new project (proxy to Cloudflare Worker)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const response = await fetch(`${WORKER_URL}/api/projects`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    return NextResponse.json(data, { status: response.status });
  } catch (error) {
    console.error("Error creating project:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create project" },
      { status: 500 }
    );
  }
}
