"use client";

import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import {
  Clock,
  ExternalLink,
  Globe,
  MapPin,
  Minus,
  Newspaper,
  RefreshCw,
  Search,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import { NewsSkeleton } from "@/components/ui/Skeletons";
import { useNewsFeed } from "@/lib/hooks/use-news-feed";

function getSentimentStyle(sentiment: "positive" | "negative" | "neutral") {
  switch (sentiment) {
    case "positive":
      return {
        icon: TrendingUp,
        color: "#2ECC71",
        bg: "rgba(46,204,113,0.1)",
        label: "Bullish",
      };
    case "negative":
      return {
        icon: TrendingDown,
        color: "#E74C3C",
        bg: "rgba(231,76,60,0.1)",
        label: "Bearish",
      };
    default:
      return {
        icon: Minus,
        color: "#F39C12",
        bg: "rgba(243,156,18,0.1)",
        label: "Neutral",
      };
  }
}

const tabs = [
  { id: "global", label: "Global", icon: Globe },
  { id: "india", label: "India", icon: MapPin },
] as const;

export default function NewsPage() {
  const [activeTab, setActiveTab] = useState<"global" | "india">("global");
  const [searchQuery, setSearchQuery] = useState("");
  const newsQuery = useNewsFeed(activeTab, searchQuery);

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--color-text-primary)" }}>
            News Feed
          </h1>
          <p className="mt-1 text-sm" style={{ color: "var(--color-text-muted)" }}>
            Curated market headlines with deterministic launch sentiment tagging
          </p>
        </div>
        <button
          onClick={() => newsQuery.refetch()}
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-white/5"
          style={{ color: "var(--color-text-muted)" }}
        >
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-1 rounded-lg p-1" style={{ background: "var(--color-surface)" }}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex items-center gap-1.5 rounded-md px-4 py-2 text-xs font-medium transition-colors"
              style={{
                background: activeTab === tab.id ? "var(--color-surface-offset)" : "transparent",
                color:
                  activeTab === tab.id
                    ? "var(--color-text-primary)"
                    : "var(--color-text-faint)",
              }}
            >
              <tab.icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" style={{ color: "var(--color-text-faint)" }} />
          <input
            type="text"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search news..."
            className="w-full rounded-lg py-2 pl-10 pr-4 text-sm outline-none sm:w-64"
            style={{
              background: "var(--color-surface)",
              border: "1px solid var(--color-border)",
              color: "var(--color-text-primary)",
            }}
          />
        </div>
      </div>

      {newsQuery.isLoading ? (
        <NewsSkeleton />
      ) : newsQuery.isError ? (
        <div className="card flex flex-col items-center py-16">
          <Newspaper className="mb-3 h-10 w-10" style={{ color: "var(--color-text-faint)" }} />
          <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
            Live news is temporarily unavailable.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <AnimatePresence mode="popLayout">
            {newsQuery.data?.articles.map((article, index) => {
              const sentiment = getSentimentStyle(article.sentiment);
              const SentimentIcon = sentiment.icon;
              const publishedLabel = formatDistanceToNow(
                new Date(article.publishedAt),
                { addSuffix: true }
              );

              return (
                <motion.article
                  key={article.id}
                  layout
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0, transition: { delay: index * 0.05 } }}
                  exit={{ opacity: 0, y: -12 }}
                  className="card group p-5 transition-all"
                >
                  <div className="flex gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="mb-2 flex items-center gap-3">
                        <span className="text-xs font-semibold" style={{ color: "var(--color-info)" }}>
                          {article.source}
                        </span>
                        <span className="flex items-center gap-1 text-xs" style={{ color: "var(--color-text-faint)" }}>
                          <Clock className="h-3 w-3" />
                          {publishedLabel}
                        </span>
                        <span
                          className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-bold"
                          style={{ background: sentiment.bg, color: sentiment.color }}
                        >
                          <SentimentIcon className="h-3 w-3" />
                          {sentiment.label}
                        </span>
                      </div>

                      <h3
                        className="mb-1 text-sm font-semibold leading-snug transition-colors group-hover:underline"
                        style={{ color: "var(--color-text-primary)" }}
                      >
                        {article.title}
                      </h3>

                      <p className="mb-3 line-clamp-2 text-xs leading-relaxed" style={{ color: "var(--color-text-muted)" }}>
                        {article.description}
                      </p>

                      <div className="flex items-center gap-2">
                        {article.relatedTickers.map((ticker) => (
                          <span
                            key={ticker}
                            className="ticker rounded px-2 py-0.5 text-[9px]"
                            style={{
                              background: "var(--color-surface-offset)",
                              color: "var(--color-text-muted)",
                            }}
                          >
                            {ticker.replace(".NS", "")}
                          </span>
                        ))}
                        <a
                          href={article.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-auto flex items-center gap-1 text-xs opacity-0 transition-opacity group-hover:opacity-100"
                          style={{ color: "var(--color-info)" }}
                        >
                          Read more <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    </div>
                  </div>
                </motion.article>
              );
            })}
          </AnimatePresence>

          {newsQuery.data?.articles.length === 0 && (
            <div className="card flex flex-col items-center py-16">
              <Newspaper className="mb-3 h-10 w-10" style={{ color: "var(--color-text-faint)" }} />
              <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
                No articles match your filter.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
