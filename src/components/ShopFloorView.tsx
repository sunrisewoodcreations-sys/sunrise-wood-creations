"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getNextProductionStage } from "@/lib/productionQueue";

const STAGE_ACTION_LABELS: Record<string, string> = {
  waiting: "Start Building",
  building: "Move to Assembly",
  assembly: "Move to Finishing",
  finishing: "Mark Ready for Pickup"
};

type BuildOrder = {
  id: string;
  customerName: string;
  isPriorityCustomer: boolean;
  productName: string;
  sizeDetails: string | null;
  productPhotoUrl: string | null;
  quantity: number;
  priority: string;
  dueDate: string | null;
  productionStatus: string;
  productionNotes: string | null;
  estimatedBuildMinutes: number | null;
  materialsAvailable: boolean;
  scheduledPickupDate: string | null;
  scheduledPickupTime: string | null;
  activeSession: { id: string; status: string; elapsed_seconds: number; resumed_at: string | null; started_at: string } | null;
  checklistSteps: { id: string; step_text: string }[];
  checkedStepIds: string[];
  materialParts: { id: string; part_name: string; length_inches: number; quantity_per_unit: number }[];
  checkedMaterialIds: string[];
  photos: { id: string; photo_url: string }[];
};

function formatElapsed(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;
}

// A live-ticking display for a running session — computed client-side
// from the session's own timestamps rather than polling the server
// every second, so the clock stays smooth without extra requests.
function LiveTimer({ session }: { session: BuildOrder["activeSession"] }) {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (session?.status !== "running") return;
    const interval = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, [session?.status]);

  if (!session) return null;
  const liveElapsed = session.status === "running"
    ? session.elapsed_seconds + Math.floor((Date.now() - new Date(session.resumed_at || session.started_at).getTime()) / 1000)
    : session.elapsed_seconds;

  return <span className="font-mono">{formatElapsed(liveElapsed)}</span>;
}

// Uses the Web Speech API where the browser supports it (most Android
// Chrome). Safari on iOS has unreliable/no support for this API, so
// this always also offers a plain text field — voice is a convenience
// on top of typing, never the only way to leave a note.
function VoiceNoteRecorder({ orderId, onSave }: { orderId: string; onSave: (orderId: string, text: string) => void }) {
  const [text, setText] = useState("");
  const [listening, setListening] = useState(false);
  const [supported] = useState(() => typeof window !== "undefined" && !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition));
  const recognitionRef = useRef<any>(null);

  function startListening() {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setText(prev => (prev ? `${prev} ${transcript}` : transcript));
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }

  function stopListening() {
    recognitionRef.current?.stop();
    setListening(false);
  }

  return (
    <div className="bg-cream rounded-lg p-3">
      <div className="text-[10px] text-[#1E3A5F]/50 uppercase font-semibold mb-1.5">Voice / Text Note</div>
      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder={supported ? "Tap the mic or type a note..." : "Type a note (voice input not supported in this browser)..."}
        rows={2}
        className="w-full border border-[#1E3A5F]/15 rounded-md px-2 py-1.5 text-sm mb-2"
      />
      <div className="flex gap-2">
        {supported && (
          <button
            onClick={listening ? stopListening : startListening}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold ${listening ? "bg-ember text-white" : "bg-white border border-[#1E3A5F]/20 text-[#1E3A5F]"}`}
          >
            {listening ? "● Stop" : "🎤 Record"}
          </button>
        )}
        <button
          onClick={() => { onSave(orderId, text); setText(""); }}
          disabled={!text.trim()}
          className="bg-[#1E3A5F] text-white px-3 py-1.5 rounded-md text-xs font-semibold disabled:opacity-50"
        >
          Save Note
        </button>
      </div>
    </div>
  );
}

export default function ShopFloorView({ orders }: { orders: BuildOrder[] }) {
  const router = useRouter();
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(orders[0]?.id || null);

  async function handleTimerAction(orderId: string, action: "start" | "pause" | "resume" | "finish") {
    setBusyOrderId(orderId);
    await fetch(`/api/orders/${orderId}/build-session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action })
    });
    setBusyOrderId(null);
    router.refresh();
  }

  async function handleAdvanceStage(orderId: string, nextStage: string) {
    setBusyOrderId(orderId);
    await fetch(`/api/orders/${orderId}/production`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productionStatus: nextStage })
    });
    setBusyOrderId(null);
    router.refresh();
  }

  async function handleReadyForPickup(orderId: string) {
    setBusyOrderId(orderId);
    await fetch(`/api/orders/${orderId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "ready_for_pickup" })
    });
    setBusyOrderId(null);
    router.refresh();
  }

  async function handleToggleChecklist(orderId: string, itemId: string, kind: "step" | "material", checked: boolean) {
    await fetch("/api/order-checklist-progress", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId, itemId, kind, checked })
    });
    router.refresh();
  }

  async function handlePhotoUpload(orderId: string, file: File) {
    setBusyOrderId(orderId);
    const formData = new FormData();
    formData.append("photo", file);
    await fetch(`/api/orders/${orderId}/progress-photo`, { method: "POST", body: formData });
    setBusyOrderId(null);
    router.refresh();
  }

  async function handleSaveVoiceNote(orderId: string, text: string) {
    if (!text.trim()) return;
    setBusyOrderId(orderId);
    await fetch(`/api/orders/${orderId}/voice-note`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text })
    });
    setBusyOrderId(null);
    router.refresh();
  }

  function goToNextJob() {
    const next = orders.find(o => o.id !== expandedOrderId) || orders[0];
    if (next) setExpandedOrderId(next.id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (orders.length === 0) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center p-6 text-center">
        <div>
          <p className="font-display text-xl text-[#1E3A5F] mb-2">Nothing to build right now</p>
          <p className="text-sm text-[#1E3A5F]/60">Every active order is either waiting to be scheduled or already at Ready for Pickup.</p>
          <Link href="/admin" className="inline-block mt-4 text-sm font-semibold text-[#1E3A5F] underline">← Back to admin</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream pb-10">
      <div className="sticky top-0 z-10 bg-[#1E3A5F] text-white px-4 py-3 flex items-center justify-between shadow-md">
        <div>
          <div className="font-display text-lg">Shop Floor</div>
          <div className="text-xs text-white/70">{orders.length} job{orders.length === 1 ? "" : "s"} today</div>
        </div>
        <Link href="/admin" className="text-xs font-semibold text-white/80 underline">Full admin →</Link>
      </div>

      <button
        onClick={goToNextJob}
        className="w-full bg-ember text-white font-display text-lg py-4 shadow-md active:bg-ember/90"
      >
        Next Job →
      </button>

      <div className="p-3 space-y-3">
        {orders.map((o, i) => {
          const isExpanded = expandedOrderId === o.id;
          const nextStage = getNextProductionStage(o.productionStatus);
          const isBusy = busyOrderId === o.id;

          return (
            <div key={o.id} className={`bg-white rounded-xl shadow-sm border-2 ${isExpanded ? "border-[#1E3A5F]" : "border-transparent"}`}>
              <button onClick={() => setExpandedOrderId(isExpanded ? null : o.id)} className="w-full flex items-center gap-3 p-3 text-left">
                <span className="w-7 h-7 rounded-full bg-[#1E3A5F] text-white text-xs font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                {o.productPhotoUrl ? (
                  <img src={o.productPhotoUrl} alt="" className="w-12 h-12 rounded-md object-cover flex-shrink-0" />
                ) : (
                  <div className="w-12 h-12 rounded-md bg-cream flex-shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-[#1E3A5F] truncate">{o.customerName}</span>
                    {o.isPriorityCustomer && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-ember/15 text-ember flex-shrink-0">Priority</span>}
                  </div>
                  <div className="text-xs text-[#1E3A5F]/60 truncate">{o.productName}{o.sizeDetails ? ` (${o.sizeDetails})` : ""} × {o.quantity}</div>
                </div>
                {o.activeSession?.status === "running" && (
                  <span className="text-xs font-bold text-sage flex-shrink-0"><LiveTimer session={o.activeSession} /></span>
                )}
              </button>

              {isExpanded && (
                <div className="px-3 pb-3 space-y-3 border-t border-[#1E3A5F]/10 pt-3">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div><span className="text-[#1E3A5F]/50">Estimated: </span><span className="font-semibold text-[#1E3A5F]">{o.estimatedBuildMinutes ? `${o.estimatedBuildMinutes}m` : "Not tracked"}</span></div>
                    <div><span className="text-[#1E3A5F]/50">Materials: </span><span className={`font-semibold ${o.materialsAvailable ? "text-sage" : "text-ember"}`}>{o.materialsAvailable ? "Ready" : "Short"}</span></div>
                    <div><span className="text-[#1E3A5F]/50">Due: </span><span className="font-semibold text-[#1E3A5F]">{o.dueDate || "—"}</span></div>
                    <div><span className="text-[#1E3A5F]/50">Pickup: </span><span className="font-semibold text-[#1E3A5F]">{o.scheduledPickupDate ? `${o.scheduledPickupDate} ${o.scheduledPickupTime}` : "Not scheduled"}</span></div>
                  </div>

                  {o.productionNotes && (
                    <p className="text-xs italic text-[#1E3A5F]/70 bg-cream rounded-md p-2">"{o.productionNotes}"</p>
                  )}

                  <div className="bg-cream rounded-lg p-3 flex items-center justify-between">
                    <div>
                      <div className="text-[10px] text-[#1E3A5F]/50 uppercase font-semibold">Build Timer</div>
                      <div className="text-lg font-display text-[#1E3A5F]">
                        {o.activeSession ? <LiveTimer session={o.activeSession} /> : "0:00"}
                      </div>
                    </div>
                    <div className="flex gap-1.5">
                      {!o.activeSession && (
                        <button onClick={() => handleTimerAction(o.id, "start")} disabled={isBusy} className="bg-sage text-white rounded-md px-3 py-2 text-xs font-semibold">Start</button>
                      )}
                      {o.activeSession?.status === "running" && (
                        <>
                          <button onClick={() => handleTimerAction(o.id, "pause")} disabled={isBusy} className="bg-amber text-white rounded-md px-3 py-2 text-xs font-semibold">Pause</button>
                          <button onClick={() => handleTimerAction(o.id, "finish")} disabled={isBusy} className="bg-[#1E3A5F] text-white rounded-md px-3 py-2 text-xs font-semibold">Finish</button>
                        </>
                      )}
                      {o.activeSession?.status === "paused" && (
                        <>
                          <button onClick={() => handleTimerAction(o.id, "resume")} disabled={isBusy} className="bg-sage text-white rounded-md px-3 py-2 text-xs font-semibold">Resume</button>
                          <button onClick={() => handleTimerAction(o.id, "finish")} disabled={isBusy} className="bg-[#1E3A5F] text-white rounded-md px-3 py-2 text-xs font-semibold">Finish</button>
                        </>
                      )}
                    </div>
                  </div>

                  {o.checklistSteps.length > 0 && (
                    <div className="bg-cream rounded-lg p-3">
                      <div className="text-[10px] text-[#1E3A5F]/50 uppercase font-semibold mb-1.5">Build Checklist</div>
                      <div className="space-y-1.5">
                        {o.checklistSteps.map(step => {
                          const isChecked = o.checkedStepIds.includes(step.id);
                          return (
                            <label key={step.id} className="flex items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={e => handleToggleChecklist(o.id, step.id, "step", e.target.checked)}
                                className="w-4 h-4 flex-shrink-0"
                              />
                              <span className={isChecked ? "text-[#1E3A5F]/40 line-through" : "text-[#1E3A5F]"}>{step.step_text}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {o.materialParts.length > 0 && (
                    <div className="bg-cream rounded-lg p-3">
                      <div className="text-[10px] text-[#1E3A5F]/50 uppercase font-semibold mb-1.5">Material Checklist</div>
                      <div className="space-y-1.5">
                        {o.materialParts.map(part => {
                          const isChecked = o.checkedMaterialIds.includes(part.id);
                          return (
                            <label key={part.id} className="flex items-center gap-2 text-sm">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={e => handleToggleChecklist(o.id, part.id, "material", e.target.checked)}
                                className="w-4 h-4 flex-shrink-0"
                              />
                              <span className={isChecked ? "text-[#1E3A5F]/40 line-through" : "text-[#1E3A5F]"}>
                                {part.part_name} — {part.length_inches}" × {part.quantity_per_unit}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="bg-cream rounded-lg p-3">
                    <div className="text-[10px] text-[#1E3A5F]/50 uppercase font-semibold mb-1.5">Progress Photos</div>
                    {o.photos.length > 0 && (
                      <div className="flex gap-2 mb-2 overflow-x-auto">
                        {o.photos.map(photo => (
                          <img key={photo.id} src={photo.photo_url} alt="" className="w-16 h-16 rounded-md object-cover flex-shrink-0" />
                        ))}
                      </div>
                    )}
                    <label className="inline-block bg-white border border-[#1E3A5F]/20 text-[#1E3A5F] px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer">
                      {isBusy ? "Uploading..." : "📷 Add Photo"}
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        disabled={isBusy}
                        onChange={e => { const file = e.target.files?.[0]; if (file) handlePhotoUpload(o.id, file); e.target.value = ""; }}
                      />
                    </label>
                  </div>

                  <VoiceNoteRecorder orderId={o.id} onSave={handleSaveVoiceNote} />

                  <div className="flex gap-2">
                    {nextStage && (
                      nextStage === "ready_for_pickup" ? (
                        <button onClick={() => handleReadyForPickup(o.id)} disabled={isBusy} className="flex-1 bg-sage text-white rounded-md py-3 text-sm font-bold disabled:opacity-60">
                          {isBusy ? "Saving..." : "✓ Ready for Pickup"}
                        </button>
                      ) : (
                        <button onClick={() => handleAdvanceStage(o.id, nextStage)} disabled={isBusy} className="flex-1 bg-[#1E3A5F] text-white rounded-md py-3 text-sm font-bold disabled:opacity-60">
                          {isBusy ? "Saving..." : STAGE_ACTION_LABELS[o.productionStatus] || "Next Stage →"}
                        </button>
                      )
                    )}
                  </div>
                  <Link href={`/admin/orders/${o.id}`} className="block text-center text-xs font-semibold text-[#1E3A5F]/60 underline">
                    Open full order page
                  </Link>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
