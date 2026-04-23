import { IIconProps } from "@/types";
import { ICONS } from "@/enums";
import { IconVectorRegistry } from "../iconVectors";

export const MapPin = ({ className, ...props }: IIconProps) => {
  const vector = IconVectorRegistry[ICONS.MAP_PIN];
  if (!vector) return null;
  return (
    <svg
      width="24"
      height="24"
      viewBox={`0 0 ${vector.viewBoxWidth} ${vector.viewBoxHeight}`}
      fill="none"
      className={className}
      {...props}
    >
      {vector.paths.map((d, idx) => (
        <path key={idx} d={d} fill="currentColor" />
      ))}
    </svg>
  );
};
