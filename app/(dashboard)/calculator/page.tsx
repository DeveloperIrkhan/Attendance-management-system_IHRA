
"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Delete,
  History,
  Calculator as CalculatorIcon,
  RotateCcw,
} from "lucide-react";

export default function CalculatorPage() {
  const [display, setDisplay] = useState("0");
  const [previousValue, setPreviousValue] = useState<string | null>(null);
  const [operator, setOperator] = useState<string | null>(null);
  const [waitingForOperand, setWaitingForOperand] = useState(false);
  const [history, setHistory] = useState<string[]>([]);

  const calculate = useCallback(
    (first: number, second: number, op: string): number => {
      switch (op) {
        case "+":
          return first + second;
        case "-":
          return first - second;
        case "×":
          return first * second;
        case "÷":
          return second === 0 ? NaN : first / second;
        default:
          return second;
      }
    },
    []
  );

  const inputDigit = (digit: string) => {
    if (display === "Error" || waitingForOperand) {
      setDisplay(digit);
      setWaitingForOperand(false);
    } else {
      setDisplay(display === "0" ? digit : display + digit);
    }
  };

  const inputDecimal = () => {
    if (display === "Error" || waitingForOperand) {
      setDisplay("0.");
      setWaitingForOperand(false);
      return;
    }

    if (!display.includes(".")) {
      setDisplay(display + ".");
    }
  };

  const clear = () => {
    setDisplay("0");
    setPreviousValue(null);
    setOperator(null);
    setWaitingForOperand(false);
  };

  const inputOperator = (nextOperator: string) => {
    const inputValue = parseFloat(display);

    if (display === "Error") return;

    if (previousValue !== null && operator && !waitingForOperand) {
      const result = calculate(
        parseFloat(previousValue),
        inputValue,
        operator
      );

      if (!Number.isFinite(result)) {
        setDisplay("Error");
        setPreviousValue(null);
        setOperator(null);
        return;
      }

      setDisplay(String(Number(result.toPrecision(12))));
      setPreviousValue(String(result));
    } else {
      setPreviousValue(display);
    }

    setOperator(nextOperator);
    setWaitingForOperand(true);
  };

  const performCalculation = () => {
    if (previousValue === null || operator === null) return;

    const first = parseFloat(previousValue);
    const second = parseFloat(display);
    const result = calculate(first, second, operator);

    if (!Number.isFinite(result)) {
      setDisplay("Error");
      setPreviousValue(null);
      setOperator(null);
      setWaitingForOperand(true);
      return;
    }

    const formatted = Number(result.toPrecision(12));

    setHistory((prev) =>
      [`${first} ${operator} ${second} = ${formatted}`, ...prev].slice(0, 10)
    );

    setDisplay(String(formatted));
    setPreviousValue(null);
    setOperator(null);
    setWaitingForOperand(true);
  };

  const handlePercent = () => {
    const value = parseFloat(display);
    if (!Number.isFinite(value)) return;
    setDisplay(String(Number((value / 100).toPrecision(12))));
  };

  const handleBackspace = () => {
    if (display === "Error" || waitingForOperand) return;
    setDisplay(display.length > 1 ? display.slice(0, -1) : "0");
  };

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      const key = event.key;

      if (/^[0-9]$/.test(key)) inputDigit(key);
      else if (key === ".") inputDecimal();
      else if (key === "+") inputOperator("+");
      else if (key === "-") inputOperator("-");
      else if (key === "*") inputOperator("×");
      else if (key === "/") {
        event.preventDefault();
        inputOperator("÷");
      } else if (key === "Enter" || key === "=") performCalculation();
      else if (key === "Backspace") handleBackspace();
      else if (key === "Escape") clear();
      else if (key === "%") handlePercent();
    },
    [display, previousValue, operator, waitingForOperand]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const buttons = [
    { label: "AC", style: "utility", action: clear },
    { label: "±", style: "utility", action: () => setDisplay(String(-parseFloat(display))) },
    { label: "%", style: "utility", action: handlePercent },
    { label: "÷", style: "operator", action: () => inputOperator("÷") },

    { label: "7", style: "number", action: () => inputDigit("7") },
    { label: "8", style: "number", action: () => inputDigit("8") },
    { label: "9", style: "number", action: () => inputDigit("9") },
    { label: "×", style: "operator", action: () => inputOperator("×") },

    { label: "4", style: "number", action: () => inputDigit("4") },
    { label: "5", style: "number", action: () => inputDigit("5") },
    { label: "6", style: "number", action: () => inputDigit("6") },
    { label: "-", style: "operator", action: () => inputOperator("-") },

    { label: "1", style: "number", action: () => inputDigit("1") },
    { label: "2", style: "number", action: () => inputDigit("2") },
    { label: "3", style: "number", action: () => inputDigit("3") },
    { label: "+", style: "operator", action: () => inputOperator("+") },
  ];

  const getButtonStyle = (style: string) => {
    const base =
      "h-16 sm:h-[72px] text-black rounded-2xl text-xl sm:text-2xl font-semibold transition-all duration-200 active:scale-95";

    switch (style) {
      case "utility":
        return `${base} bg-slate-700/70 text-cyan-300 hover:bg-slate-600`;
      case "operator":
        return `${base} bg-indigo-500/20 text-indigo-300 border border-indigo-400/20 hover:bg-indigo-500/40`;
      default:
        return `${base} bg-slate-800 text-white hover:bg-slate-700 border border-white/5`;
    }
  };

  return (
    <main className="min-h-screen bg-[#080d1b] text-white flex items-center justify-center p-4 sm:p-8">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -left-32 h-96 w-96 rounded-full bg-indigo-600/20 blur-[120px]" />
        <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-cyan-500/10 blur-[120px]" />
      </div>

      <div className="relative w-full max-w-5xl grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">

        {/* Calculator */}
        <section className="rounded-[32px] border border-white/10 bg-slate-900/80 backdrop-blur-2xl shadow-2xl p-5 sm:p-8">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-2xl bg-indigo-500/20 flex items-center justify-center">
                <CalculatorIcon className="text-indigo-400" size={25} />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight">Calculator</h1>
                <p className="text-xs text-slate-400">Smart & Simple</p>
              </div>
            </div>

            <span className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1 text-xs text-emerald-400">
              Online
            </span>
          </div>

          {/* Display */}
          <div className="rounded-3xl bg-[#080e1d] border border-white/5 p-6 sm:p-8 mb-6 text-right min-w-0">
            <p className="text-sm text-slate-500 h-6">
              {previousValue !== null && operator
                ? `${previousValue} ${operator}`
                : "Ready to calculate"}
            </p>

            <div className="text-4xl sm:text-6xl font-light tracking-tight mt-3 whitespace-nowrap">
              {display}
            </div>

            <div className="flex justify-end mt-4">
              <button
                onClick={handleBackspace}
                className="flex items-center gap-2 text-sm text-slate-500 hover:text-red-400 transition"
              >
                <Delete size={16} />
                Delete
              </button>
            </div>
          </div>

          {/* Buttons */}
          <div className="grid grid-cols-4 gap-3">
            {buttons.map((button) => (
              <button
                key={button.label}
                onClick={button.action}
                className={getButtonStyle(button.style)}
              >
                {button.label}
              </button>
            ))}

            <button
              onClick={() => inputDigit("0")}
              className={`${getButtonStyle("number")} col-span-2`}
            >
              0
            </button>

            <button
              onClick={inputDecimal}
              className={getButtonStyle("number")}
            >
              .
            </button>

            <button
              onClick={performCalculation}
              className="h-16 sm:h-[72px] rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-2xl font-bold shadow-lg shadow-indigo-500/20 hover:brightness-110 active:scale-95 transition-all"
            >
              =
            </button>
          </div>

          <p className="text-center text-xs text-slate-600 mt-7">
            Supports keyboard input · ESC to clear · Enter to calculate
          </p>
        </section>

        {/* History */}
        <aside className="rounded-[32px] border border-white/10 bg-slate-900/80 backdrop-blur-2xl shadow-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <History className="text-indigo-400" size={20} />
              <h2 className="font-semibold text-lg">History</h2>
            </div>

            <button
              onClick={() => setHistory([])}
              className="text-xs text-slate-500 hover:text-red-400 transition"
            >
              Clear all
            </button>
          </div>

          {history.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-center">
              <div className="h-14 w-14 rounded-2xl bg-slate-800 flex items-center justify-center mb-4">
                <RotateCcw size={22} className="text-slate-500" />
              </div>
              <p className="text-slate-400 text-sm">No calculations yet</p>
              <p className="text-slate-600 text-xs mt-2">
                Your calculations will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-3 max-h-max overflow-y-auto">
              {history.map((item, index) => (
                <div
                  key={`${item}-${index}`}
                  className="rounded-2xl bg-slate-800/70 border border-white/5 p-4"
                >
                  <p className="text-xs text-slate-400">
                    Calculation {history.length - index}
                  </p>
                  <p className="text-sm text-slate-200 mt-2 break-all">
                    {item}
                  </p>
                </div>
              ))}
            </div>
          )}
        </aside>
      </div>
    </main>
  );
}
