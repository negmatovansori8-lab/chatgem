import { describe, expect, it } from "vitest";
import { detectMapIntent, isMapRelatedQuery } from "@/lib/maps/intent";

describe("map intent", () => {
  it("detects nearby pharmacy in RU/TG/EN", () => {
    expect(detectMapIntent("аптеки рядом со мной").type).toBe("nearby");
    expect(detectMapIntent("ближайшая больница").type).toBe("nearby");
    expect(detectMapIntent("pharmacy near me").type).toBe("nearby");
    expect(detectMapIntent("дорхонаи наздик").type).toBe("nearby");
  });

  it("treats 'Сентри <city>' as the city centre (scoped search, no extra query)", () => {
    const a = detectMapIntent("Сентри Душанбе");
    expect(a.type).toBe("search");
    if (a.type === "search") {
      expect(a.scope?.label).toMatch(/душанбе/i);
      expect(a.query).toBe("");
    }
  });

  it("detects route and locate", () => {
    expect(detectMapIntent("как добраться").type).toBe("route");
    expect(detectMapIntent("моё местоположение").type).toBe("locate");
  });

  it("flags map-related queries", () => {
    expect(isMapRelatedQuery("ресторан в Худжанде")).toBe(true);
    expect(isMapRelatedQuery("что такое фотосинтез")).toBe(false);
  });
});
