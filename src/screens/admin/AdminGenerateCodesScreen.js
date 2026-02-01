// screens/AdminGenerateCodesScreen.js
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  Alert,
  ScrollView,
} from 'react-native';
import { generateOfflineCodes } from '../../utils/dbHelper';
import RNFS from 'react-native-fs';
import Share from 'react-native-share';
import RNPrint from 'react-native-print';
import AdminHeader from '../../components/AdminHeader';
import { Show } from '../../components/SafeConditional';

export default function AdminGenerateCodesScreen() {
  const [count, setCount] = useState('20');
  const [subjectId, setSubjectId] = useState('');
  const [subjectName, setSubjectName] = useState('');
  const [amount, setAmount] = useState('1000');
  const [generated, setGenerated] = useState([]);

  const handleGenerate = async () => {
    const c = Number(count) || 20;
    const codes = await generateOfflineCodes(c, {
      subjectId: subjectId ? Number(subjectId) : null,
      subject: subjectName || null,
      amount: Number(amount) || 0,
    });
    setGenerated(codes);
  };

  /* ================= LOGO BASE64 ================= */
  const loadLogoBase64 = async () => {
    const path = RNFS.AssetDirectoryPath + '/images/logo.jpeg';
    try {
      const base64 = await RNFS.readFile(path, 'base64');
      return `data:image/jpeg;base64,${base64}`;
    } catch (error) {
      console.log('Logo Base64 error:', error);
      return '';
    }
  };

  /* ================= EXPORT CSV ================= */
  const exportCSV = async () => {
    if (!generated.length) return Alert.alert('No data');

    const csv =
      'code,subject,amount\n' +
      generated
        .map(g => `${g.code},${g.subject || 'Any'},${g.amount}`)
        .join('\n');

    const path = `${RNFS.DownloadDirectoryPath}/offline_codes_${Date.now()}.csv`;

    try {
      await RNFS.writeFile(path, csv, 'utf8');
      await Share.open({
        type: 'text/csv',
        url: 'file://' + path,
        showAppsToView: true,
      });
    } catch (e) {
      Alert.alert('CSV Error', e.message);
    }
  };

  /* ================= EXPORT PDF ================= */
  const exportPDF = async () => {
    if (!generated.length) return Alert.alert('No data');

    const logoBase64 = await loadLogoBase64();
    const printedAt = new Date().toLocaleString();

    const rowsHTML = generated
      .reduce((rows, item, index) => {
        if (index % 2 === 0) rows.push([]);
        rows[rows.length - 1].push(item);
        return rows;
      }, [])
      .map(
        row => `
      <tr>
        ${row
          .map(
            g => `
          <td class="cell">
            <div class="card">
              <img src="${logoBase64}" class="logo" />
              <h2>Zuhsyn EduBox</h2>
              <p><strong>CODE:</strong> ${g.code}</p>
              <p><strong>COURSE:</strong> ${g.subject || 'Any'}</p>
              <p><strong>AMOUNT:</strong> ₦${g.amount}</p>
              <div class="seal">VERIFIED<br/>BY<br/>ZUHSYN EDUBOX</div>
              <div class="print-time">Printed: ${printedAt}</div>
            </div>
          </td>
        `
          )
          .join('')}
        ${row.length === 1 ? `<td class="cell"></td>` : ''}
      </tr>
    `
      )
      .join('');

    const html = `
      <html>
      <head>
      <style>
        body { font-family: Arial; padding: 20px; }
        table { width: 100%; border-spacing: 15px; }
        .cell { width: 50%; vertical-align: top; }
        .card {
          border: 2px dashed #333;
          padding: 15px;
          border-radius: 10px;
          height: 220px;
          position: relative;
          overflow: hidden;
          background: #fff;
        }
        .card::before {
          content: "Zuhsyn EduBox   Zuhsyn EduBox   Zuhsyn EduBox";
          position: absolute;
          top: 50%;
          left: 50%;
          width: 200%;
          transform: translate(-50%, -50%) rotate(-25deg);
          font-size: 18px;
          color: rgba(0,0,0,0.06);
          text-align: center;
          line-height: 40px;
        }
        .logo { width: 60px; margin: 0 auto 8px; display:block; }
        h2 { text-align: center; margin-bottom: 8px; }
        p { font-size: 14px; margin: 4px 0; }
        .seal {
          position: absolute;
          right: 10px;
          bottom: 10px;
          width: 60px;
          height: 60px;
          border-radius: 50%;
          border: 3px solid gold;
          color: gold;
          font-size: 9px;
          font-weight: bold;
          display: flex;
          align-items: center;
          justify-content: center;
          text-align: center;
        }
        .print-time {
          position: absolute;
          left: 50%;
          transform: translateX(-50%);
          bottom: 8px;
          font-size: 9px;
          color: #555;
        }
      </style>
      </head>
      <body>
        <table>${rowsHTML}</table>
      </body>
      </html>
    `;

    try {
      await RNPrint.print({ html });
    } catch (e) {
      Alert.alert('PDF Error', e.message);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <AdminHeader title="Generate Offline Codes" />

      <Text style={styles.label}>Count</Text>
      <TextInput value={count} onChangeText={setCount} keyboardType="numeric" style={styles.input} />

      <Text style={styles.label}>Course ID (optional)</Text>
      <TextInput value={subjectId} onChangeText={setSubjectId} style={styles.input} />

      <Text style={styles.label}>Course name (optional)</Text>
      <TextInput value={subjectName} onChangeText={setSubjectName} style={styles.input} />

      <Text style={styles.label}>Amount</Text>
      <TextInput value={amount} onChangeText={setAmount} keyboardType="numeric" style={styles.input} />

      <TouchableOpacity style={styles.btn} onPress={handleGenerate}>
        <Text style={styles.btnText}>Generate</Text>
      </TouchableOpacity>

      <Show when={generated.length > 0}>
        <>
          <TouchableOpacity style={styles.pdfBtn} onPress={exportPDF}>
            <Text style={styles.btnText}>Download PDF</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.csvBtn} onPress={exportCSV}>
            <Text style={styles.btnText}>Download CSV</Text>
          </TouchableOpacity>
        </>
      </Show>

      <FlatList
        data={generated}
        keyExtractor={i => i.code}
        renderItem={({ item }) => (
          <Text style={{ padding: 6 }}>
            {item.code} — {item.subject || 'Any'} — ₦{item.amount}
          </Text>
        )}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  label: { fontWeight: '700', marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#ddd', padding: 10, borderRadius: 8, marginBottom: 12 },
  btn: { backgroundColor: '#001F54', padding: 12, borderRadius: 10, alignItems: 'center', marginBottom: 12 },
  pdfBtn: { backgroundColor: '#009688', padding: 12, borderRadius: 10, alignItems: 'center', marginBottom: 10 },
  csvBtn: { backgroundColor: '#FF9800', padding: 12, borderRadius: 10, alignItems: 'center', marginBottom: 10 },
  btnText: { color: '#fff', fontWeight: '700' },
});
