import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url);
    const code = searchParams.get("code");
    const token_hash = searchParams.get("token_hash");
    const type = searchParams.get("type");

    // Supabase sends either a code (PKCE flow) or token_hash (email confirm link)
    if (token_hash && type) {
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );
        await supabase.auth.verifyOtp({ token_hash, type: type as "signup" | "email" });
    }

    return NextResponse.redirect(`${origin}/welcome`);
}
