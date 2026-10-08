import { describe, expect, it } from "vitest";
import { pickVoice, type VoiceLike } from "./tts";

const voice = (lang: string, name = lang): VoiceLike => ({ lang, name });

describe("pickVoice", () => {
  it("prefers the course locale", () => {
    const voices = [voice("es-US"), voice("es-ES"), voice("en-US")];
    expect(pickVoice(voices, "es-ES")?.lang).toBe("es-ES");
  });

  it("falls back from Spain to Mexico to US Spanish", () => {
    expect(pickVoice([voice("es-US"), voice("es-MX")], "es-ES")?.lang).toBe("es-MX");
    expect(pickVoice([voice("en-GB"), voice("es-US")], "es-ES")?.lang).toBe("es-US");
  });

  it("accepts any voice of the language after that", () => {
    expect(pickVoice([voice("en-US"), voice("es-AR")], "es-ES")?.lang).toBe("es-AR");
    expect(pickVoice([voice("es")], "es-ES")?.lang).toBe("es");
  });

  it("reads Android's underscore tags and any letter case", () => {
    expect(pickVoice([voice("es_mx")], "es-ES")?.lang).toBe("es_mx");
    expect(pickVoice([voice("ES-es")], "es-ES")?.lang).toBe("ES-es");
  });

  it("never mistakes another language for Spanish", () => {
    expect(pickVoice([voice("en-US"), voice("et-EE"), voice("eu-ES")], "es-ES")).toBeNull();
  });

  it("finds nothing in an empty list", () => {
    expect(pickVoice([], "es-ES")).toBeNull();
  });
});
