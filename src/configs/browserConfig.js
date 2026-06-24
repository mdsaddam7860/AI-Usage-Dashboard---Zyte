export const getBrowserConfig = (isLocalTest = true) => {
  return {
    headless: !isLocalTest, // Opens a visible browser if true
    defaultViewport: null,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  };
};
