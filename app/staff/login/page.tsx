import { signIn } from "./actions";

export default async function StaffLogin({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const error = params.error === "1";

  return (
    <div className="flex min-h-full flex-col items-center justify-center bg-zinc-950 font-sans">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900 p-8">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-lg font-black text-white">
          L
        </div>
        <h1 className="mt-4 text-2xl font-bold text-zinc-50">Staff sign in</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Enter the staff passcode to open the conversation console.
        </p>
        <form className="mt-6 flex flex-col gap-3" action={signIn}>
          <label className="text-sm font-medium text-zinc-300" htmlFor="passcode">
            Passcode
          </label>
          <input
            id="passcode"
            name="passcode"
            type="password"
            required
            autoComplete="current-password"
            className="h-11 w-full rounded-xl border border-zinc-700 bg-zinc-800 px-3 text-zinc-100 outline-none focus:border-emerald-500"
          />
          {error && (
            <p className="text-sm text-red-400">Incorrect passcode. Try again.</p>
          )}
          <button
            type="submit"
            className="h-11 w-full rounded-xl bg-emerald-600 font-semibold text-white transition-colors hover:bg-emerald-700"
          >
            Sign in
          </button>
        </form>
      </div>
    </div>
  );
}