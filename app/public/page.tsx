"use client";

import { useEffect } from "react";
import { sitePath } from "@/lib/site-path";

export default function LegacyPublicPage() {
  useEffect(() => {
    window.location.replace(sitePath("main/"));
  }, []);

  return <p className="library-empty-state">검색 화면으로 이동하고 있습니다.</p>;
}
