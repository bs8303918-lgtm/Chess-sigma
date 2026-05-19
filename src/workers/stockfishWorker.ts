let engine: Worker | null = null;

type SearchPayload = {
  fen: string;
  depth?: number;
  moveTime?: number;
  skillLevel?: number;
};

type WorkerResponse =
  | { type: "bestmove"; move: string }
  | { type: "error"; message: string };

const post = (message: WorkerResponse) => {
  self.postMessage(message);
};

self.onmessage = (event: MessageEvent<SearchPayload>) => {
  const { fen, depth = 10, moveTime = 500, skillLevel = 10 } = event.data;

  try {
    if (!engine) {
      engine = new Worker("/stockfish/stockfish-18-lite-single.js");
    }

    engine.onmessage = (engineEvent: MessageEvent<string>) => {
      if (typeof engineEvent.data !== "string") return;

      if (engineEvent.data.startsWith("bestmove")) {
        const bestmove = engineEvent.data.split(" ")[1];
        post({ type: "bestmove", move: bestmove });
      }
    };

    engine.postMessage("uci");
    engine.postMessage(`setoption name Skill Level value ${skillLevel}`);
    engine.postMessage("isready");
    engine.postMessage(`position fen ${fen}`);
    engine.postMessage(`go depth ${depth} movetime ${moveTime}`);
  } catch (error) {
    post({
      type: "error",
      message: error instanceof Error ? error.message : "Stockfish worker crashed",
    });
  }
};
