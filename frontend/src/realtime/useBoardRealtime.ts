import { useEffect, useState } from "react";
import { HubConnectionBuilder, LogLevel } from "@microsoft/signalr";
import { useQueryClient } from "@tanstack/react-query";
import { tokenStore } from "../api/client";

const baseUrl = import.meta.env.VITE_API_URL ?? "http://localhost:5090";

export type LiveStatus = "connecting" | "live" | "offline";

export function useBoardRealtime(boardId: string): LiveStatus {
  const qc = useQueryClient();
  const [status, setStatus] = useState<LiveStatus>("connecting");

  useEffect(() => {
    if (!boardId) return;
    let stopped = false;

    const connection = new HubConnectionBuilder()
      .withUrl(`${baseUrl}/hubs/board`, { accessTokenFactory: () => tokenStore.get() ?? "" })
      .withAutomaticReconnect()
      .configureLogging(LogLevel.Warning)
      .build();

    const refresh = () => {
      qc.invalidateQueries({ queryKey: ["board", boardId] });
      qc.invalidateQueries({ queryKey: ["columns", boardId] });
      qc.invalidateQueries({ queryKey: ["boards"] });
    };

    connection.on("BoardChanged", refresh);
    connection.onreconnecting(() => setStatus("connecting"));
    connection.onreconnected(() => {
      connection
        .invoke("JoinBoard", boardId)
        .then(() => {
          refresh();
          setStatus("live");
        })
        .catch(() => setStatus("offline"));
    });
    connection.onclose(() => {
      if (!stopped) setStatus("offline");
    });

    connection
      .start()
      .then(() => connection.invoke("JoinBoard", boardId))
      .then(() => {
        if (!stopped) setStatus("live");
      })
      .catch(() => {
        if (!stopped) setStatus("offline");
      });

    return () => {
      stopped = true;
      void connection.stop();
    };
  }, [boardId, qc]);

  return status;
}
