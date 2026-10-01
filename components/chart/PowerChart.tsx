"use client";

import ReactECharts from "echarts-for-react";
import type { EChartsType } from "echarts";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import { buildOption, EXPORT_CROP_BOTTOM, type ChartModelInput } from "./chartModel";

export type PowerChartHandle = {
  /** PNG of the chart at 2× resolution, without the range slider. */
  getImageDataUrl: () => Promise<string>;
};

type Props = ChartModelInput & {
  height?: number;
  /** Called (debounced) when the user moves the range slider. */
  onRangeChange?: (startIndex: number, endIndex: number) => void;
};

const RANGE_DEBOUNCE_MS = 150;
const EXPORT_PIXEL_RATIO = 2;

/** Cut the slider strip off the bottom of an exported chart image. */
function cropBottom(dataUrl: string, cssPixels: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = Math.max(1, img.height - cssPixels * EXPORT_PIXEL_RATIO);
      const ctx = canvas.getContext("2d");
      if (!ctx) return resolve(dataUrl);
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => reject(new Error("Could not create the chart image."));
    img.src = dataUrl;
  });
}

/**
 * The line chart. It knows nothing about the page around it, so it can be
 * reused elsewhere (e.g. inside PowerBanks.com).
 */
export const PowerChart = forwardRef<PowerChartHandle, Props>(function PowerChart(
  { height = 480, onRangeChange, ...model },
  ref,
) {
  const chartRef = useRef<EChartsType | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const onRangeChangeRef = useRef(onRangeChange);
  useEffect(() => {
    onRangeChangeRef.current = onRangeChange;
  });

  const { dates, labels, series, startIndex, endIndex, percentMode, trends } = model;
  const option = useMemo(
    () => buildOption({ dates, labels, series, startIndex, endIndex, percentMode, trends }),
    [dates, labels, series, startIndex, endIndex, percentMode, trends],
  );

  const handleReady = useCallback((chart: EChartsType) => {
    chartRef.current = chart;
    chart.on("datazoom", () => {
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => {
        const zoom = (chart.getOption() as { dataZoom?: { startValue?: number; endValue?: number }[] }).dataZoom?.[0];
        if (zoom?.startValue == null || zoom.endValue == null) return;
        onRangeChangeRef.current?.(Math.round(zoom.startValue), Math.round(zoom.endValue));
      }, RANGE_DEBOUNCE_MS);
    });
  }, []);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  useImperativeHandle(
    ref,
    () => ({
      async getImageDataUrl() {
        const chart = chartRef.current;
        if (!chart) throw new Error("The chart is not ready yet.");
        // No sliders in exported output: hide it for the snapshot, then put it back.
        chart.setOption({ dataZoom: [{ id: "range", show: false }] });
        let url: string;
        try {
          url = chart.getDataURL({ type: "png", pixelRatio: EXPORT_PIXEL_RATIO, backgroundColor: "#fff" });
        } finally {
          chart.setOption({ dataZoom: [{ id: "range", show: true }] });
        }
        return cropBottom(url, EXPORT_CROP_BOTTOM);
      },
    }),
    [],
  );

  return (
    <ReactECharts
      option={option}
      // Series and axes are replaced (not merged) so removed datasets disappear.
      replaceMerge={["series", "yAxis"]}
      style={{ height, width: "100%" }}
      onChartReady={handleReady}
      opts={OPTS}
    />
  );
});

const OPTS = { renderer: "canvas" } as const;
