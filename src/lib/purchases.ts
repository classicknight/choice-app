import { Platform } from "react-native";
import Purchases, { LOG_LEVEL, type PurchasesStoreProduct } from "react-native-purchases";

export const MATCH_PACK_8_PRODUCT_ID = "match_pack_8";
export const MATCH_PACK_8_CREDIT_AMOUNT = 8;

const revenueCatApiKeyByPlatform = {
  ios: process.env.EXPO_PUBLIC_REVENUECAT_APPLE_API_KEY?.trim() ?? "",
  android: process.env.EXPO_PUBLIC_REVENUECAT_GOOGLE_API_KEY?.trim() ?? "",
};

let purchasesConfiguredForUserId: string | null = null;
let purchasesInitialized = false;

export function getRevenueCatApiKey() {
  if (Platform.OS === "ios") {
    return revenueCatApiKeyByPlatform.ios;
  }

  if (Platform.OS === "android") {
    return revenueCatApiKeyByPlatform.android;
  }

  return "";
}

export function hasRevenueCatConfig() {
  return Boolean(getRevenueCatApiKey());
}

export async function configureRevenueCat(userId: string) {
  const apiKey = getRevenueCatApiKey();

  if (!apiKey) {
    return;
  }

  Purchases.setLogLevel(LOG_LEVEL.INFO);

  if (!purchasesInitialized) {
    Purchases.configure({
      apiKey,
      appUserID: userId,
    });
    purchasesInitialized = true;
    purchasesConfiguredForUserId = userId;
    return;
  }

  if (purchasesConfiguredForUserId === userId) {
    return;
  }

  await Purchases.logIn(userId);
  purchasesConfiguredForUserId = userId;
}

export async function syncRevenueCatUser(userId: string) {
  if (!hasRevenueCatConfig()) {
    return;
  }

  if (purchasesConfiguredForUserId !== userId) {
    await configureRevenueCat(userId);
    return;
  }

  await Purchases.logIn(userId);
}

export async function logOutRevenueCat() {
  if (!hasRevenueCatConfig()) {
    purchasesConfiguredForUserId = null;
    return;
  }

  await Purchases.logOut();
  purchasesConfiguredForUserId = null;
}

export async function getMatchPackStoreProduct() {
  const apiKey = getRevenueCatApiKey();

  if (!apiKey) {
    return null;
  }

  const products = await Purchases.getProducts(
    [MATCH_PACK_8_PRODUCT_ID],
    Purchases.PRODUCT_CATEGORY.NON_SUBSCRIPTION,
  );

  return products.find((entry) => entry.identifier === MATCH_PACK_8_PRODUCT_ID) ?? null;
}

export async function purchaseMatchPackProduct(product?: PurchasesStoreProduct | null) {
  const targetProduct = product ?? await getMatchPackStoreProduct();

  if (!targetProduct) {
    throw new Error("MATCH_PACK_NOT_READY");
  }

  return Purchases.purchaseStoreProduct(targetProduct);
}
