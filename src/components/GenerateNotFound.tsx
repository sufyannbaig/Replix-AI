import { Link } from "@tanstack/react-router";

export function GenerateNotFound() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">Product not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The product you're looking for doesn't exist or has been removed.
        </p>
        <Link
          to="/create"
          className="mt-6 inline-flex items-center justify-center rounded-full bg-brand-gradient px-6 py-2 text-sm font-semibold text-white shadow-soft transition hover:opacity-95"
        >
          Browse products
        </Link>
      </div>
    </div>
  );
}
