"use strict";
const { CognitoJwtVerifier } = require("aws-jwt-verify");
console.log("Inside Authorizer lambda", process.env.USER_POOL_ID);
console.log("Inside Authorizer lambda2", process.env.CLIENT_ID);
const jwtVerifier = CognitoJwtVerifier.create({
  userPoolId: process.env.USER_POOL_ID,
  tokenUse: "access",
  clientId: process.env.CLIENT_ID, //,
  //customJwtCheck: ({ payload }) => {
  //  assertStringEquals("e-mail", payload["email"], process.env.USER_EMAIL);
  //},
});

exports.handler = async (event) => {
  // console.log("request:", JSON.stringify(event, undefined, 2));

  const jwt = event.headers.authorization.split(" ")[1];
  let isAuthorized = false;
  try {
    const payload = await jwtVerifier.verify(jwt);
    console.log("Access allowed. JWT payload:", payload);
    isAuthorized = true;
  } catch (err) {
    console.error("Access forbidden:", err);
  } finally {
    const response = {
      isAuthorized: isAuthorized,
    };
    console.log("response", response);
    return response;
  }
};