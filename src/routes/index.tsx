import { createFileRoute } from "@tanstack/react-router";
import { CatChess } from "@/components/CatChess";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Cat Chess — A cute chess game with cat pieces" },
      { name: "description", content: "Play classic chess with adorable cat-themed pieces. Move history, timer, undo, sounds — fully in your browser." },
      { property: "og:title", content: "Cat Chess" },
      { property: "og:description", content: "Play classic chess with adorable cat-themed pieces." },
    ],
  }),
  component: Index,
});

function Index() {
  return <CatChess />;
}
