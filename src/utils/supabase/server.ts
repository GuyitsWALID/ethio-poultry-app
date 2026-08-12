import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const createClient = async (
  cookieStore?: Awaited<ReturnType<typeof cookies>> | ReturnType<typeof cookies>
) => {
  const resolvedStore = await Promise.resolve(cookieStore ?? cookies());

  return createServerClient(supabaseUrl!, supabaseKey!, {
    cookies: {
      getAll() {
        return typeof resolvedStore.getAll === "function" ? resolvedStore.getAll() : [];
      },
      setAll(cookiesToSet) {
        try {
          if (typeof resolvedStore.set === "function") {
            cookiesToSet.forEach(({ name, value, options }) =>
              resolvedStore.set(name, value, options)
            );
          }
        } catch {
          // Ignore when called from a Server Component.
        }
      },
    },
  });
};
