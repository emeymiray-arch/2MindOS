import { ZodError, type ZodTypeAny } from "zod";
import { apiJson } from "@/lib/api-response";

export class ApiValidationError extends Error {
  constructor(
    message: string,
    public readonly issues: { path: string; message: string }[] = []
  ) {
    super(message);
    this.name = "ApiValidationError";
  }
}

export function formatZodError(err: ZodError): ApiValidationError {
  const issues = err.issues.map((i) => ({
    path: i.path.join(".") || "(root)",
    message: i.message,
  }));
  const first = issues[0];
  return new ApiValidationError(first?.message ?? "Некорректный запрос", issues);
}

/** Read JSON body once. Throws ApiValidationError if not JSON. */
export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new ApiValidationError("Ожидался JSON");
  }
}

/** Validate an already-parsed value with Zod. */
export function parseValue<S extends ZodTypeAny>(
  raw: unknown,
  schema: S
): S["_output"] {
  const result = schema.safeParse(raw ?? {});
  if (!result.success) throw formatZodError(result.error);
  return result.data;
}

/** Parse JSON body and validate with Zod. Throws ApiValidationError on failure. */
export async function parseBody<S extends ZodTypeAny>(
  request: Request,
  schema: S
): Promise<S["_output"]> {
  return parseValue(await readJson(request), schema);
}

export function validationErrorResponse(e: unknown) {
  if (e instanceof ApiValidationError) {
    return apiJson({ error: e.message, issues: e.issues }, { status: 400 });
  }
  if (e instanceof ZodError) {
    const err = formatZodError(e);
    return apiJson({ error: err.message, issues: err.issues }, { status: 400 });
  }
  return null;
}
