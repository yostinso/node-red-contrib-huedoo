export type XYColor = { x: number, y: number };
export type HueColorGamut = { blue: XYColor, red: XYColor, green: XYColor };
export type GamutType = "A" | "B" | "C" | "other";
export type GradientColor = { color: { xy: XYColor; } }

export type ColorSettings = {
    on?: { on: boolean };
    dimming?: { brightness: number; }
    color_temperature?: {
        mirek?: number;
        mirek_valid?: boolean;
        mirek_schema?: { mirek_minimum: number, mirek_maximum: number };
    }
    color?: {
        xy: XYColor;
        gamut: HueColorGamut;
        gamut_type: GamutType;
    }
    gradient?: {
        points: GradientColor[];
        points_capable: number;
    }
}
