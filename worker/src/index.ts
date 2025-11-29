export interface Env {
  DB: D1Database;
}

interface ProjectData {
  name: string;
  category: string;
  description: string;
  imageUrl?: string;
  githubUrl?: string;
  websiteUrl?: string;
  docsUrl?: string;
  xUrl?: string;
  projectToken: string;
  creatorWallet: string;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // Route: GET /api/projects
    if (url.pathname === "/api/projects" && request.method === "GET") {
      return handleGetProjects(url, env);
    }

    // Route: POST /api/projects
    if (url.pathname === "/api/projects" && request.method === "POST") {
      return handleCreateProject(request, env);
    }

    // Route: GET /api/projects/:id
    const projectMatch = url.pathname.match(/^\/api\/projects\/([^/]+)$/);
    if (projectMatch && request.method === "GET") {
      return handleGetProject(projectMatch[1], env);
    }

    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  },
};

async function handleGetProjects(url: URL, env: Env): Promise<Response> {
  try {
    const category = url.searchParams.get("category");
    const search = url.searchParams.get("search");

    let query = "SELECT * FROM projects";
    const params: string[] = [];

    if (category || search) {
      query += " WHERE";
      if (category) {
        query += " category = ?";
        params.push(category);
      }
      if (search) {
        if (category) query += " AND";
        query += " (name LIKE ? OR description LIKE ?)";
        params.push(`%${search}%`, `%${search}%`);
      }
    }

    query += " ORDER BY created_at DESC";

    const result = await env.DB.prepare(query).bind(...params).all();

    return new Response(
      JSON.stringify({
        success: true,
        projects: result.results,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error fetching projects:", error);
    return new Response(
      JSON.stringify({ success: false, error: "Failed to fetch projects" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
}

async function handleGetProject(id: string, env: Env): Promise<Response> {
  try {
    const result = await env.DB.prepare("SELECT * FROM projects WHERE id = ?")
      .bind(id)
      .first();

    if (!result) {
      return new Response(
        JSON.stringify({ success: false, error: "Project not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        project: result,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error fetching project:", error);
    return new Response(
      JSON.stringify({ success: false, error: "Failed to fetch project" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
}

async function handleCreateProject(request: Request, env: Env): Promise<Response> {
  try {
    const body: ProjectData = await request.json();

    // Validate required fields
    if (!body.name || !body.category || !body.description || !body.projectToken || !body.creatorWallet) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Generate a unique ID
    const id = crypto.randomUUID();

    // Ensure all values are strings or null (D1 doesn't support objects)
    const imageUrl = typeof body.imageUrl === 'string' ? body.imageUrl : null;
    const githubUrl = typeof body.githubUrl === 'string' ? body.githubUrl : null;
    const websiteUrl = typeof body.websiteUrl === 'string' ? body.websiteUrl : null;
    const docsUrl = typeof body.docsUrl === 'string' ? body.docsUrl : null;
    const xUrl = typeof body.xUrl === 'string' ? body.xUrl : null;
    const creatorWallet = typeof body.creatorWallet === 'string'
      ? body.creatorWallet
      : String(body.creatorWallet);

    const result = await env.DB.prepare(
      `INSERT INTO projects (id, name, category, description, image_url, github_url, website_url, docs_url, x_url, project_token, creator_wallet)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        id,
        body.name,
        body.category,
        body.description,
        imageUrl,
        githubUrl,
        websiteUrl,
        docsUrl,
        xUrl,
        body.projectToken,
        creatorWallet
      )
      .run();

    if (!result.success) {
      throw new Error("Failed to insert project");
    }

    return new Response(
      JSON.stringify({
        success: true,
        project: {
          id,
          ...body,
          fundingAmount: 0,
          backersCount: 0,
          createdAt: new Date().toISOString(),
        },
      }),
      {
        status: 201,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error creating project:", error);
    return new Response(
      JSON.stringify({ success: false, error: "Failed to create project" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
}
