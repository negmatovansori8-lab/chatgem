import { describe, expect, it } from "vitest";
import {
  addressTitle,
  addressVariants,
  areaLine,
  houseNumberOf,
  isExactAddress,
  localityLine,
  looksLikeAddress,
  russianSpelling,
} from "@/lib/maps/address";
import { detectMapIntent } from "@/lib/maps/intent";

describe("street address parsing", () => {
  it("recognises street addresses in TG/RU/EN", () => {
    expect(looksLikeAddress("кӯчаи Рӯдакӣ 25, Душанбе")).toBe(true);
    expect(looksLikeAddress("ул. Рудаки 25")).toBe(true);
    expect(looksLikeAddress("Rudaki Avenue 25 Dushanbe")).toBe(true);
    expect(looksLikeAddress("проспект Исмоили Сомонӣ")).toBe(true);
  });

  it("does not treat place names or categories as addresses", () => {
    expect(looksLikeAddress("Душанбе")).toBe(false);
    expect(looksLikeAddress("кафе дар Душанбе")).toBe(false);
    expect(looksLikeAddress("")).toBe(false);
  });

  it("extracts only the typed house number", () => {
    expect(houseNumberOf("кӯчаи Рӯдакӣ 25, Душанбе")).toBe("25");
    expect(houseNumberOf("ул. Айни 12/3")).toBe("12/3");
    expect(houseNumberOf("дом 7а, Худжанд")).toBe("7а");
    expect(houseNumberOf("кӯчаи Рӯдакӣ, Душанбе")).toBeUndefined();
  });

  it("builds query variants: typed → bare → Russian spelling", () => {
    const v = addressVariants("кӯчаи Рӯдакӣ 25, Душанбе");
    expect(v[0]).toBe("кӯчаи Рӯдакӣ 25, Душанбе");
    expect(v).toContain("Рӯдакӣ 25, Душанбе");
    expect(v).toContain("Рудаки 25, Душанбе");
    expect(russianSpelling("Ҳисор, Ғафуров, Қӯрғонтеппа")).toBe("Хисор, Гафуров, Кургонтеппа");
  });

  it("routes the address query to a place search", () => {
    expect(detectMapIntent("кӯчаи Рӯдакӣ 25, Душанбе").type).toBe("search");
  });
});

describe("address display", () => {
  const postal = {
    road: "проспект Рудаки",
    houseNumber: "25",
    neighbourhood: "Сино",
    district: "Душанбе",
    city: "Душанбе",
    country: "Тоҷикистон",
  };

  it("never invents a house number", () => {
    expect(addressTitle(postal)).toBe("проспект Рудаки, 25");
    expect(addressTitle({ road: "проспект Рудаки" })).toBe("проспект Рудаки");
    expect(addressTitle({ city: "Душанбе" })).toBeUndefined();
  });

  it("formats locality and area without duplicates", () => {
    expect(localityLine(postal)).toBe("Сино, Душанбе, Тоҷикистон");
    expect(localityLine(postal, { withArea: false })).toBe("Душанбе, Тоҷикистон");
    expect(areaLine(postal)).toBe("Сино");
  });

  it("flags city-only results as not exact", () => {
    expect(isExactAddress(postal)).toBe(true);
    expect(isExactAddress({ city: "Душанбе", country: "Тоҷикистон" })).toBe(false);
    expect(isExactAddress(undefined)).toBe(false);
  });
});
