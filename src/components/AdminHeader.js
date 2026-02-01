import React, { useContext } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { useNavigation } from "@react-navigation/native";
import { AuthContext } from "../context/AuthContext";

export default function AdminHeader({ title = '' }) {
  const navigation = useNavigation();
  const { logout } = useContext(AuthContext) || {};

  return (
    <View style={styles.header}>

      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconBtn}>
        <Icon name="arrow-left" size={26} color="#001F54" />
      </TouchableOpacity>

      <Text style={styles.title}>
        {typeof title === 'string' ? title : String(title)}
      </Text>

      <TouchableOpacity
        onPress={() => typeof logout === 'function' && logout()}
        style={styles.iconBtn}
      >
        <Icon name="logout" size={26} color="#d40000" />
      </TouchableOpacity>

    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    height: 60,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#e1e5ee",
  },
  iconBtn: {
    padding: 5,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#001F54",
  },
});
