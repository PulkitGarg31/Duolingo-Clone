import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api/errors";
import { domainErrorMessage } from "./domainErrorMessage";

function apiError(status: number, code: ApiError["code"], detail = ""): ApiError {
  return new ApiError({ status, code, title: code, detail });
}

describe("domainErrorMessage", () => {
  it("uses the feature's copy for known domain errors", () => {
    expect(domainErrorMessage(apiError(409, "INSUFFICIENT_GEMS"), { INSUFFICIENT_GEMS: "Not enough gems" })).toBe("Not enough gems");
  });

  it("falls back to the server's explanation for other domain errors", () => {
    expect(domainErrorMessage(apiError(409, "ALREADY_LEGENDARY", "This level is already Legendary."))).toBe(
      "This level is already Legendary.",
    );
  });

  it("stays quiet for failures the app already toasts", () => {
    expect(domainErrorMessage(apiError(0, "NETWORK_ERROR"))).toBeNull();
    expect(domainErrorMessage(apiError(503, "HTTP_ERROR"))).toBeNull();
    expect(domainErrorMessage(apiError(500, "INTERNAL_ERROR"))).toBeNull();
  });
});
