// screens/admin/AdminAnalyticsScreen.js
import React, { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, ScrollView, Dimensions } from 'react-native';
import { getTotalRevenue, getSalesBySubject, getCodeRedemptions, getPaymentStats } from '../../utils/dbHelper';
import { BarChart, LineChart, PieChart } from 'react-native-chart-kit';
import AdminHeader from "../../components/AdminHeader";
import { Show } from '../../components/SafeConditional';


const screenWidth = Dimensions.get('window').width - 24;

export default function AdminAnalyticsScreen() {
  const [loading, setLoading] = useState(true);
  const [revenue, setRevenue] = useState(0);
  const [sales, setSales] = useState([]);
  const [codeData, setCodeData] = useState({ total:0, monthly:[] });
  const [paymentStats, setPaymentStats] = useState([]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const r = await getTotalRevenue();
      const s = await getSalesBySubject();
      const c = await getCodeRedemptions({ months: 6 });
      const p = await getPaymentStats();
      setRevenue(r);
      setSales(s);
      setCodeData(c);
      setPaymentStats(p);
    } catch (e) {
      console.error('AdminAnalytics load failed', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadAll(); }, []);

  if (loading) {
    return <View style={{flex:1,justifyContent:'center',alignItems:'center'}}><ActivityIndicator/></View>;
  }

  // Prepare datasets
  const barLabels = sales.map(s => s.subject);
  const barValues = sales.map(s => Number(s.revenue || 0));

  const lineLabels = codeData.monthly.map(m => m.month.split('-')[1] + '/' + m.month.split('-')[0].slice(2));
  const lineValues = codeData.monthly.map(m => m.count);

  const pieData = paymentStats.map((s, i) => ({
    name: s.status,
    population: Number(s.count || 0),
    color: i===0?'#2ecc71': i===1? '#ffcc00': '#e74c3c',
    legendFontColor: '#333',
    legendFontSize: 12
  }));

return (
  <ScrollView contentContainerStyle={{ padding: 12 }}>

    {/* HEADER */}
    <View>
      <AdminHeader title="Admin Analytics" />
    </View>

    {/* TOTAL REVENUE */}
    <View style={{ backgroundColor: '#fff', padding: 12, borderRadius: 10, marginBottom: 12 }}>
      <Text style={{ color: '#666' }}>Total Revenue</Text>
      <Text style={{ fontSize: 24, fontWeight: '800' }}>
        ₦{String(revenue ?? 0)}
      </Text>
    </View>

    {/* SALES BY COURSE */}
    <View style={{ backgroundColor: '#fff', padding: 12, borderRadius: 10, marginBottom: 12 }}>
      <Text style={{ marginBottom: 6, fontWeight: '700' }}>Sales by Course</Text>

      <Show when={Array.isArray(barValues) && barValues.length > 0}>
        <BarChart
          data={{
            labels: Array.isArray(barLabels) ? barLabels.map(String) : [],
            datasets: [{ data: barValues.map(n => Number(n) || 0) }],
          }}
          width={screenWidth}
          height={220}
          fromZero
          chartConfig={{
            backgroundColor: '#fff',
            backgroundGradientFrom: '#fff',
            backgroundGradientTo: '#fff',
            decimalPlaces: 0,
            color: (opacity = 1) => `rgba(10,34,85, ${opacity})`,
            labelColor: (opacity = 1) => `rgba(0,0,0, ${opacity})`,
          }}
          style={{ borderRadius: 8 }}
        />
      </Show>

      <Show when={!Array.isArray(barValues) || barValues.length === 0}>
        <Text style={{ color: '#666' }}>No sales yet</Text>
      </Show>
    </View>

    {/* CODE REDEMPTIONS */}
    <View style={{ backgroundColor: '#fff', padding: 12, borderRadius: 10, marginBottom: 12 }}>
      <Text style={{ marginBottom: 6, fontWeight: '700' }}>
        Code Redemptions (last {String(Array.isArray(lineLabels) ? lineLabels.length : 0)} months)
      </Text>

      <Show when={Array.isArray(lineValues) && lineValues.length > 0}>
        <LineChart
          data={{
            labels: Array.isArray(lineLabels) ? lineLabels.map(String) : [],
            datasets: [{ data: lineValues.map(n => Number(n) || 0) }],
          }}
          width={screenWidth}
          height={180}
          chartConfig={{
            backgroundColor: '#fff',
            backgroundGradientFrom: '#fff',
            backgroundGradientTo: '#fff',
            decimalPlaces: 0,
            color: (opacity = 1) => `rgba(11,116,255, ${opacity})`,
            labelColor: (opacity = 1) => `rgba(0,0,0, ${opacity})`,
          }}
          bezier
          style={{ borderRadius: 8 }}
        />
      </Show>

      <Show when={!Array.isArray(lineValues) || lineValues.length === 0}>
        <Text style={{ color: '#666' }}>No code redemptions</Text>
      </Show>
    </View>

    {/* PAYMENT STATUS DISTRIBUTION */}
    <View style={{ backgroundColor: '#fff', padding: 12, borderRadius: 10 }}>
      <Text style={{ marginBottom: 6, fontWeight: '700' }}>
        Payment Status Distribution
      </Text>

      <Show when={Array.isArray(pieData) && pieData.length > 0}>
        <PieChart
          data={pieData.map(item => ({
            ...item,
            name: String(item?.name ?? ''),
            population: Number(item?.population) || 0,
            color: String(item?.color ?? '#ccc'),
            legendFontColor: String(item?.legendFontColor ?? '#000'),
            legendFontSize: Number(item?.legendFontSize) || 12,
          }))}
          width={screenWidth}
          height={200}
          chartConfig={{
            color: (opacity = 1) => `rgba(0,0,0, ${opacity})`,
          }}
          accessor="population"
          backgroundColor="transparent"
          paddingLeft="15"
          absolute
        />
      </Show>

      <Show when={!Array.isArray(pieData) || pieData.length === 0}>
        <Text style={{ color: '#666' }}>No payments yet</Text>
      </Show>
    </View>

  </ScrollView>
);
}