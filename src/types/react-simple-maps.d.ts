declare module "react-simple-maps" {
  import { ComponentType, CSSProperties } from "react";

  interface ProjectionConfig {
    center?: [number, number];
    rotate?: [number, number, number];
    scale?: number;
    parallels?: [number, number];
  }

  interface ComposableMapProps {
    projection?: string;
    projectionConfig?: ProjectionConfig;
    width?: number;
    height?: number;
    style?: CSSProperties;
    children?: React.ReactNode;
  }

  interface GeographiesChildProps {
    geographies: GeographyType[];
  }

  interface GeographyType {
    rsmKey: string;
    properties: Record<string, unknown> & { name: string };
  }

  interface GeographiesProps {
    geography: string | Record<string, unknown>;
    children: (props: GeographiesChildProps) => React.ReactNode;
  }

  interface GeographyStyleProps {
    default?: CSSProperties;
    hover?: CSSProperties;
    pressed?: CSSProperties;
  }

  interface GeographyProps {
    geography: GeographyType;
    key?: string;
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
    style?: GeographyStyleProps;
  }

  interface MarkerProps {
    coordinates: [number, number];
    key?: string;
    children?: React.ReactNode;
  }

  export const ComposableMap: ComponentType<ComposableMapProps>;
  export const Geographies: ComponentType<GeographiesProps>;
  export const Geography: ComponentType<GeographyProps>;
  export const Marker: ComponentType<MarkerProps>;
}
