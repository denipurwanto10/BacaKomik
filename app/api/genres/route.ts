import { getGenres } from "@/lib/api/genre";
import { handle } from "../_lib";

export async function GET() {
  // Daftar genre jarang berubah — simpan 1 jam.
  return handle(() => getGenres(), { revalidate: 3600 });
}
