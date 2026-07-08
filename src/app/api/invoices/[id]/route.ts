import { NextRequest, NextResponse } from "next/server";
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

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  // createClient() respects the logged-in user's session and Row Level
  // Security, so a customer can only ever pull up their own invoice, and
  // trying someone else's order id here simply returns nothing.
  const supabase = createClient();
  const { data: order } = await supabase.from("orders").select("*").eq("id", params.id).single();

  if (!order) {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }

  const price = (order.price_cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });

  const doc = (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Sunrise Wood Creations</Text>
        <Text style={styles.sub}>Invoice for order #{order.id.slice(0, 8).toUpperCase()}</Text>

        <View style={styles.row}>
          <Text style={styles.label}>Order date</Text>
          <Text>{new Date(order.created_at).toLocaleDateString()}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Product</Text>
          <Text>{productLabel(order.product_type as ProductType)}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Description</Text>
          <Text>{order.title}</Text>
        </View>
        {order.size_details && (
          <View style={styles.row}>
            <Text style={styles.label}>Size / details</Text>
            <Text>{order.size_details}</Text>
          </View>
        )}

        <View style={styles.divider} />

        <View style={styles.row}>
          <Text style={styles.total}>Total</Text>
          <Text style={styles.total}>{price}</Text>
        </View>

        <View style={styles.divider} />
        <Text style={{ color: "#6b5c4d" }}>
          Questions about this invoice? Call (269) 762-1460 or email sunrisewoodcreations@gmail.com.
        </Text>
      </Page>
    </Document>
  );

  const buffer = await renderToBuffer(doc);

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="invoice-${order.id.slice(0, 8)}.pdf"`
    }
  });
}
