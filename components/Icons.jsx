// One consistent set of line icons (24×24, stroke = currentColor) so every
// screen looks like it belongs to the same app — replacing the mix of
// colourful emoji that rendered differently on every phone.

function Svg({ children, size = 24, className = '', fill = 'none', strokeWidth = 1.8 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill}
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export const HomeIcon = (p) => (
  <Svg {...p}><path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" /></Svg>
);

export const CompassIcon = (p) => (
  <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="m15.5 8.5-2 5-5 2 2-5z" /></Svg>
);

export const PlusIcon = (p) => (
  <Svg {...p} strokeWidth={2.4}><path d="M12 5v14M5 12h14" /></Svg>
);

export const InboxIcon = (p) => (
  <Svg {...p}><rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="m3.5 7 8.5 6 8.5-6" /></Svg>
);

export const UserIcon = (p) => (
  <Svg {...p}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></Svg>
);

export const SearchIcon = (p) => (
  <Svg {...p}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></Svg>
);

export const BagIcon = (p) => (
  <Svg {...p}><path d="M5 8h14l-1 12H6z" /><path d="M9 8V6a3 3 0 0 1 6 0v2" /></Svg>
);

export const HeartIcon = ({ filled, ...p }) => (
  <Svg {...p} fill={filled ? 'currentColor' : 'none'}>
    <path d="M12 20.5s-7.5-4.6-9.2-9.4A5 5 0 0 1 12 6.7a5 5 0 0 1 9.2 4.4c-1.7 4.8-9.2 9.4-9.2 9.4z" />
  </Svg>
);

export const CommentIcon = (p) => (
  <Svg {...p}><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.5-4.6A8 8 0 1 1 21 12z" /></Svg>
);

export const SendIcon = (p) => (
  <Svg {...p}><path d="M21 3 10 14" /><path d="m21 3-7 18-4-7-7-4z" /></Svg>
);

export const CheckIcon = (p) => (
  <Svg {...p} strokeWidth={2.6}><path d="m5 12.5 4.5 4.5L19 7.5" /></Svg>
);

export const PhoneIcon = (p) => (
  <Svg {...p}>
    <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" />
  </Svg>
);

export const VolumeIcon = (p) => (
  <Svg {...p}>
    <path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z" />
    <path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a8 8 0 0 1 0 11" />
  </Svg>
);

export const VolumeOffIcon = (p) => (
  <Svg {...p}>
    <path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z" />
    <path d="m16 9.5 5 5M21 9.5l-5 5" />
  </Svg>
);

export const PlayIcon = (p) => (
  <Svg {...p} fill="currentColor" strokeWidth={0}><path d="M7 4.5v15l13-7.5z" /></Svg>
);

export const BoxIcon = (p) => (
  <Svg {...p}>
    <path d="M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5z" />
    <path d="m3.5 7.5 8.5 4.5 8.5-4.5M12 12v9" />
  </Svg>
);

export const BankIcon = (p) => (
  <Svg {...p}>
    <path d="m3 9 9-5 9 5" />
    <path d="M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18" />
  </Svg>
);

export const PostIcon = (p) => (
  <Svg {...p}>
    <rect x="3.5" y="3.5" width="17" height="17" rx="3" />
    <path d="M12 8v8M8 12h8" />
  </Svg>
);

export const EditIcon = (p) => (
  <Svg {...p}><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z" /><path d="m13.5 6.5 4 4" /></Svg>
);

export const VerifiedIcon = ({ size = 16, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" className={className} aria-label="Verified">
    <path
      fill="currentColor"
      d="M12 2.2 14.4 4l3-.2.9 2.9 2.6 1.6-.9 2.9.9 2.9-2.6 1.6-.9 2.9-3-.2L12 21.8 9.6 20l-3 .2-.9-2.9L3.1 15.7 4 12.8 3.1 9.9l2.6-1.6.9-2.9 3 .2z"
    />
    <path d="m8.5 12.3 2.4 2.4 4.6-4.9" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const ChevronRightIcon = (p) => (
  <Svg {...p}><path d="m9 5 7 7-7 7" /></Svg>
);
