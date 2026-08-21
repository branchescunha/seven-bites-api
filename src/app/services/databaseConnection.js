export const connectMongo = async ({ mongoUrl, mongooseClient }) => {
  try {
    const connection = await mongooseClient.connect(mongoUrl);

    return { connection, status: 'ok' };
  } catch (error) {
    return { error, status: 'unavailable' };
  }
};
