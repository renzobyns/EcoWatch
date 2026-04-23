import { GoogleGenerativeAI } from "@google/generative-ai";

// System instructions to guide the AI's behavior
const systemInstruction = `
You are the "EcoWatch Guide", a friendly, concises, and helpful AI assistant for the EcoWatch SJDM website.
EcoWatch is a system for San Jose del Monte (SJDM) to monitor and report waterway pollution and illegal dumping in real-time.

Key areas of the website you should know about:
- Report Issue (/report): Where users report environmental violations.
- Barangay Portal (/barangay): Where barangay officials manage reports.
- CENRO Dashboard (/cenro): Where the City Environment and Natural Resources Office views analytics and heatmaps.
- Geospatial mapping: The app uses Maps to auto-assign reports and DBSCAN clustering for hotspots.
- AI Verification: The app uses Mask R-CNN to validate reports.

Guidelines:
- Keep your answers VERY short and concise (1-3 sentences maximum).
- Be encouraging and eco-friendly.
- If asked about something unrelated to the environment, EcoWatch, or SJDM, gently steer the conversation back to your purpose.
- Do not use markdown formatting (like **bold**) excessively, plain text is preferred for this chat bubble.
`;

export async function POST(req: Request) {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "Gemini API key not configured." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
  
  const genAI = new GoogleGenerativeAI(apiKey);

  try {
    const { message, history } = await req.json();

    // Initialize the model
    // We use gemini-2.0-flash as it's the standard fast model
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      systemInstruction: systemInstruction,
    });

    // Format previous history for Gemini
    // Gemini expects history in the format: { role: 'user' | 'model', parts: [{ text: '...' }] }
    const formattedHistory = history.map((msg: any) => ({
      role: msg.role === "user" ? "user" : "model",
      parts: [{ text: msg.content }],
    }));

    // Start chat session
    const chat = model.startChat({
      history: formattedHistory,
    });

    // Send the new message and get a streaming response
    const result = await chat.sendMessageStream(message);

    // Create a readable stream from the Gemini stream
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of result.stream) {
            const text = chunk.text();
            controller.enqueue(new TextEncoder().encode(text));
          }
          controller.close();
        } catch (err) {
          controller.error(err);
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
      },
    });
  } catch (error: any) {
    console.error("====== GEMINI API ERROR ======");
    console.error("Message:", error?.message);
    console.error("Stack:", error?.stack);
    console.error("Full Error:", JSON.stringify(error, null, 2));
    console.error("==============================");
    
    // ============================================================================
    // FALLBACK / MOCK MODE FOR PRESENTATION
    // Since the Google Gemini free API key is currently hitting strict quota/region 
    // limitations from Google's servers, we are returning a beautiful simulated
    // response so the chat interface can still be demonstrated flawlessly.
    const mockResponseText = "Hello! I am the EcoWatch Guide (Simulated). The actual AI connection is currently paused due to Google API limits, but the EcoWatch system still aims to help San Jose del Monte monitor and resolve illegal dumping in real-time. How can I assist you with using the reporting portal or viewing the heatmaps?";
    
    const stream = new ReadableStream({
        async start(controller) {
            const encoder = new TextEncoder();
            const words = mockResponseText.split(/(\s+)/);
            
            for (const word of words) {
                // Simulate typing delay (20ms)
                await new Promise(resolve => setTimeout(resolve, 20));
                controller.enqueue(encoder.encode(word));
            }
            controller.close();
        }
    });
    
    return new Response(stream, {
        headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Transfer-Encoding": "chunked",
        },
    });
    // ============================================================================
    
    /* 
    // Original error handling
    return new Response(
      JSON.stringify({ 
        error: "Failed to communicate with AI.", 
        details: error?.message || "Unknown error occurred" 
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
    */
  }
}
