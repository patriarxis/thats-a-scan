import { IIconProps } from "@/types";
import { ICONS } from "@/enums";
import { IconVectorRegistry } from "../iconVectors";

export const Meal = ({ className, ...props }: IIconProps) => {
  const meal = IconVectorRegistry[ICONS.MEAL];
  if (!meal) return null;
  return (
    <svg
      width="24"
      height="24"
      viewBox={`0 0 ${meal.viewBoxWidth} ${meal.viewBoxHeight}`}
      fill="none"
      className={className}
      {...props}
    >
      {meal.paths.map((d, idx) => (
        <path key={idx} d={d} fill="currentColor" />
      ))}
    </svg>
  );
};
