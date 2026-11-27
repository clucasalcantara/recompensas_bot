import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { House } from "../types";

export function StairChart({ house }: { house: House }) {
  const weeks = house.weeks;
  const max = Math.max(1, ...weeks.flatMap((week) => [week.lucas, week.gi]));
  const width = 640;
  const barSpace = 168;
  const gap = 14;
  const group = (width - gap * Math.max(weeks.length - 1, 0)) / Math.max(weeks.length, 1);
  const empty = weeks.every((week) => week.lucas === 0 && week.gi === 0);
  const month = house.month;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-2xl">As semanas</CardTitle>
        <CardDescription>
          {month.lucas + month.gi === 0
            ? `Em ${month.label} a escada ainda não andou.`
            : `Em ${month.label}, ${house.lucasName} ${month.lucas} min e ${house.giName} ${month.gi} min.`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-4 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-2">
            <span className="size-2.5 rounded-full bg-caio" />
            {house.lucasName}
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="size-2.5 rounded-full bg-gi" />
            {house.giName}
          </span>
        </div>
        <svg className="h-auto w-full" viewBox="0 0 640 210" role="img" aria-label="Minutos de escada nas últimas semanas">
          {weeks.map((week, index) => {
            const x = index * (group + gap);
            return (
              <g key={`${week.label}-${index}`}>
                <Bar x={x + 2} value={week.lucas} max={max} space={barSpace} color="var(--caio)" width={Math.max(4, group / 2 - 6)} />
                <Bar x={x + group / 2} value={week.gi} max={max} space={barSpace} color="var(--gi)" width={Math.max(4, group / 2 - 6)} />
                <text
                  x={x + group / 2}
                  y={202}
                  textAnchor="middle"
                  fontSize={13}
                  fill="currentColor"
                  className="fill-muted-foreground"
                  fontFamily="var(--font-outfit), sans-serif"
                >
                  {week.label.replace(" de ", " ").replace(".", "")}
                </text>
              </g>
            );
          })}
        </svg>
        {empty ? <p className="text-sm text-muted-foreground">Quando a escada andar, o desenho cresce aqui.</p> : null}
      </CardContent>
    </Card>
  );
}

function Bar({
  x,
  value,
  max,
  space,
  color,
  width,
}: {
  x: number;
  value: number;
  max: number;
  space: number;
  color: string;
  width: number;
}) {
  const height = value === 0 ? 3 : Math.max(6, (value / max) * space);
  return (
    <rect x={x} y={176 - height} width={width} height={height} rx={6} fill={color} aria-label={`${value} min`} />
  );
}
