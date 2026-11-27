import type { House } from "../types";

export function StairChart({ house }: { house: House }) {
  const weeks = house.weeks;
  const max = Math.max(1, ...weeks.flatMap((week) => [week.lucas, week.gi]));
  const width = 640;
  const barSpace = 168;
  const gap = 10;
  const group = (width - gap * Math.max(weeks.length - 1, 0)) / Math.max(weeks.length, 1);
  const empty = weeks.every((week) => week.lucas === 0 && week.gi === 0);
  const month = house.month;

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>A escada</h2>
        <p>
          {month.lucas + month.gi === 0
            ? `Em ${month.label} a escada ainda não andou.`
            : `Em ${month.label}, ${house.lucasName} ${month.lucas} min e ${house.giName} ${month.gi} min.`}
        </p>
      </div>
      <div className="legend">
        <span>{house.lucasName}</span>
        <span>{house.giName}</span>
      </div>
      <svg className="chart" viewBox="0 0 640 210" role="img" aria-label="Minutos de escada nas últimas semanas">
        {weeks.map((week, index) => {
          const x = index * (group + gap);
          return (
            <g key={`${week.label}-${index}`}>
              <Bar x={x + 2} value={week.lucas} max={max} space={barSpace} color="#3d6b8c" width={Math.max(4, group / 2 - 6)} />
              <Bar
                x={x + group / 2}
                value={week.gi}
                max={max}
                space={barSpace}
                color="#c45362"
                width={Math.max(4, group / 2 - 6)}
              />
              <text
                x={x + group / 2}
                y={202}
                textAnchor="middle"
                fontSize={13}
                fill="#7a625c"
                fontFamily="var(--font-outfit), sans-serif"
              >
                {week.label.replace(" de ", " ").replace(".", "")}
              </text>
            </g>
          );
        })}
      </svg>
      {empty ? <p className="empty">Quando a escada andar, o desenho cresce aqui.</p> : null}
    </section>
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
    <rect x={x} y={176 - height} width={width} height={height} rx={5} fill={color}>
      <title>{value} min</title>
    </rect>
  );
}
