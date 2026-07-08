import { NextRequest, NextResponse } from "next/server";
import React from "react";
import { renderToBuffer, Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import { createClient } from "@/lib/supabase/server";
import { productLabel, ProductType } from "@/lib/statusSteps";

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 11, fontFamily: "Helvetica" },
  title: { fontSize: 20, marginBottom: 4, color: "#3D2B1F" },
  sub: { fontSize: 10, color: "#6b5c4d", marginBottom: 24 },
  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  label: { color: "#6b5c4d" },
  divider: { borderBottomWidth: 1, borderBottomColor: "#e5d9c3", marginVertical: 16 },
  total: { fontSize: 14, marginTop: 8 }
});

const e = React.createElement;

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: order } = await supabase.from("orders").select("*").eq("id", params.id).single();

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const price = (order.price_cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });

  const rows = [
    e(View, { style: styles.row, key: "date" }, [
      e(Text, { style: styles.label, key: "l" }, "Order date"),
      e(Text, { key: "v" }, new Date(order.created_at).toLocaleDateString())
    ]),
    e(View, { style: styles.row, key: "product" }, [
      e(Text, { style: styles.label, key: "l" }, "Product"),
      e(Text, { key: "v" }, productLabel(order.product_type as ProductType))
    ]),
    e(View, { style: styles.row, key: "desc" }, [
      e(Text, { style: styles.label, key: "l" }, "Description"),
      e(Text, { key: "v" }, order.title)
    ])
  ];

  if (order.size_details) {
    rows.push(
      e(View, { style: styles.row, key: "size" }, [
        e(Text, { style: styles.label, key: "l" }, "Size / details"),
        e(Text, { key: "v" }, order.size_details)
      ])
    );
  }

  const doc = e(
    Document,
    null,
    e(
      Page,
      { size: "A4", style: styles.page },
      e(Text, { style: styles.title }, "Sunrise Wood Creations"),
      e(Text, { style: styles.sub }, `Invoice for order #${order.id.slice(0, 8).toUpperCase()}`),
      ...rows,
      e(View, { style: styles.divider }),
      e(View, { style: styles.row }, [
        e(Text, { style: styles.total, key: "l" }, "Total"),
        e(Text, { style: styles.total, key: "v" }, price)
      ]),
      e(View, { style: styles.divider }),
      e(
        Text,
        { style: { color: "#6b5c4d" } },
        "Questions about this invoice? Call (269) 762-1460 or email sunrisewoodcreations@gmail.com."
      )
    )
  );

  const buffer = await renderToBuffer(doc);

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="invoice-${order.id.slice(0, 8)}.pdf"`
    }
  });
}
