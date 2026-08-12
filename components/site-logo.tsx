import Link from "next/link";

type SiteLogoProps = {
  showText?: boolean;
};

export function SiteLogo({ showText = false }: SiteLogoProps) {
  return (
    <Link className="site-logo" href="/main" aria-label="메인 페이지로 이동">
      <span className="logo-mark" aria-hidden="true">
        <span />
      </span>
      {showText ? (
        <div className="brand">
          <strong>Reading Log</strong>
          <span>나만의 독서기록장</span>
        </div>
      ) : null}
    </Link>
  );
}
