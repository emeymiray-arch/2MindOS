/** Thin line icons — Apple-ish, no emoji. */

type IconProps = { size?: number; className?: string };

function Svg({
  size = 20,
  className,
  children,
}: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      {children}
    </svg>
  );
}

export function IconHome(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5z" />
    </Svg>
  );
}

export function IconPath(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M5 19c3-1 5-4 5-7s2-6 5-7" />
      <circle cx="7" cy="18" r="2" />
      <circle cx="17" cy="6" r="2" />
    </Svg>
  );
}

export function IconMap(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M9 4 3 6.5v13.5l6-2.5 6 2.5 6-2.5V3.5L15 6 9 3.5v.5z" />
      <path d="M9 4v13.5M15 6v13.5" />
    </Svg>
  );
}

export function IconCalendar(p: IconProps) {
  return (
    <Svg {...p}>
      <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
      <path d="M8 3.5V7M16 3.5V7M3.5 10h17" />
    </Svg>
  );
}

export function IconChart(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M4 19h16" />
      <path d="M7 16V10M12 16V7M17 16v-5" />
    </Svg>
  );
}

export function IconWallet(p: IconProps) {
  return (
    <Svg {...p}>
      <rect x="3" y="6" width="18" height="13" rx="2" />
      <path d="M3 10h18M16 14.5h2" />
    </Svg>
  );
}

export function IconHabits(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="8" />
      <path d="m8.5 12.5 2.3 2.3 4.7-5" />
    </Svg>
  );
}

export function IconWish(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 4.5 14.2 9l4.8.5-3.6 3.3.9 4.7L12 15.3 7.7 17.5l.9-4.7L5 9.5 9.8 9 12 4.5z" />
    </Svg>
  );
}

export function IconMore(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="6" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
      <circle cx="18" cy="12" r="1.4" fill="currentColor" stroke="none" />
    </Svg>
  );
}

export function IconFlame(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 3c2 3 1 5 1 6.5A3.5 3.5 0 0 1 8 13c0 3 2.2 5 4 5s4-2 4-5c0-2.5-1-4-1-6.5-.5 1.5-1.5 2.5-3 3.5z" />
    </Svg>
  );
}

export function IconSteps(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M5 19h4v-4H5v4zM10 15h4V9h-4v6zM15 11h4V5h-4v6z" />
    </Svg>
  );
}

export function IconAlert(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 4 3.5 19h17L12 4z" />
      <path d="M12 10v4M12 16.5v.5" />
    </Svg>
  );
}

export function IconTarget(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
    </Svg>
  );
}

export function IconNote(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M7 4.5h8.5L19 8v11.5a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-14a1 1 0 0 1 1-1z" />
      <path d="M15 4.5V9h4.5M9 12h6M9 15.5h4" />
    </Svg>
  );
}

export function IconInbox(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M4 8h16v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8z" />
      <path d="M4 12h4l1.5 2h5L16 12h4" />
      <path d="m4 8 2.5-4h11L20 8" />
    </Svg>
  );
}

export function IconBook(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M5 5.5A2.5 2.5 0 0 1 7.5 3H19v15.5H7.5A2.5 2.5 0 0 0 5 21V5.5z" />
      <path d="M5 18.5A2.5 2.5 0 0 1 7.5 16H19" />
    </Svg>
  );
}

export function IconArchive(p: IconProps) {
  return (
    <Svg {...p}>
      <rect x="3.5" y="4" width="17" height="4" rx="1.2" />
      <path d="M5.5 8v10.5a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1V8M10 12h4" />
    </Svg>
  );
}

export function IconSettings(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3.5v2.2M12 18.3v2.2M4.9 6.5l1.6 1.6M17.5 15.9l1.6 1.6M3.5 12h2.2M18.3 12h2.2M4.9 17.5l1.6-1.6M17.5 8.1l1.6-1.6" />
    </Svg>
  );
}

export function IconShield(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 3.5 5 6.5v5.2c0 4.2 2.8 7.2 7 8.8 4.2-1.6 7-4.6 7-8.8V6.5L12 3.5z" />
      <path d="m9.5 12 1.8 1.8 3.5-3.8" />
    </Svg>
  );
}

export function IconPlus(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 6v12M6 12h12" />
    </Svg>
  );
}

export function IconInner(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3.5" />
    </Svg>
  );
}

export function IconOuter(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 4v16M4 12h16" />
    </Svg>
  );
}

export function IconCoin(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 7.5v9M9.5 9.5c.7-.8 1.5-1.1 2.5-1.1s2 .5 2 1.6c0 2.2-4 1.4-4 3.6 0 1.1.9 1.7 2 1.7s1.8-.3 2.4-1" />
    </Svg>
  );
}

export function IconTrendUp(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M4 16.5 10 10l3.5 3.5L20 7" />
      <path d="M14 7h6v6" />
    </Svg>
  );
}

export function IconTrendDown(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M4 7.5 10 14l3.5-3.5L20 17" />
      <path d="M14 17h6v-6" />
    </Svg>
  );
}

export function IconBag(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M8 8V5.5a1 1 0 0 1 1-1h9.5a1 1 0 0 1 1 1V16a1 1 0 0 1-1 1H16" />
      <rect x="4" y="8" width="12" height="11.5" rx="1" />
    </Svg>
  );
}
