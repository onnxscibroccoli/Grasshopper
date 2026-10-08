#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function resolveRef(root, ref) {
  if (!ref.startsWith("#/")) throw new Error(`unsupported schema reference: ${ref}`);
  return ref.slice(2).split("/").reduce((value, part) => value?.[part], root);
}

function matchesType(value, type) {
  if (type === "null") return value === null;
  if (type === "array") return Array.isArray(value);
  if (type === "object") return isObject(value);
  if (type === "integer") return Number.isInteger(value);
  if (type === "number") return typeof value === "number" && Number.isFinite(value);
  return typeof value === type;
}

function validate(schema, value, root, location = "$", errors = []) {
  if (schema.$ref) {
    const target = resolveRef(root, schema.$ref);
    if (!target) throw new Error(`schema reference not found: ${schema.$ref}`);
    if (value === null && Array.isArray(schema.type) && schema.type.includes("null")) return errors;
    return validate(target, value, root, location, errors);
  }
  const types = schema.type ? (Array.isArray(schema.type) ? schema.type : [schema.type]) : [];
  if (types.length && !types.some((type) => matchesType(value, type))) {
    errors.push(`${location}: must be ${types.join("|")}`);
    return errors;
  }
  if ("const" in schema && value !== schema.const) errors.push(`${location}: must equal ${JSON.stringify(schema.const)}`);
  if (schema.enum && !schema.enum.includes(value)) errors.push(`${location}: must be one of ${schema.enum.join("|")}`);
  if (typeof value === "string") {
    if (schema.minLength && value.length < schema.minLength) errors.push(`${location}: must not be empty`);
    if (schema.format === "date-time" && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(value)) {
      errors.push(`${location}: must be an RFC 3339 UTC timestamp`);
    }
  }
  if (typeof value === "number" && schema.minimum !== undefined && value < schema.minimum) {
    errors.push(`${location}: must be >= ${schema.minimum}`);
  }
  if (Array.isArray(value)) {
    if (schema.minItems && value.length < schema.minItems) errors.push(`${location}: must contain at least ${schema.minItems} item(s)`);
    if (schema.items) value.forEach((item, index) => validate(schema.items, item, root, `${location === "$" ? "" : `${location}/`}${index}`, errors));
  }
  if (isObject(value)) {
    for (const required of schema.required ?? []) {
      if (!(required in value)) errors.push(`${location}/${required}: required property is missing`);
    }
    for (const [key, item] of Object.entries(value)) {
      const child = location === "$" ? key : `${location}/${key}`;
      if (schema.properties?.[key]) validate(schema.properties[key], item, root, child, errors);
      else if (schema.additionalProperties === false) errors.push(`${child}: additional property is not allowed`);
    }
  }
  return errors;
}

export function validateJsonSchemaSubset(schema, value) {
  return validate(schema, value, schema);
}

function main(argv) {
  if (argv.length !== 2) {
    console.error("usage: node scripts/validate-json-schema-subset.mjs SCHEMA.json VALUE.json");
    return 64;
  }
  try {
    const schema = JSON.parse(fs.readFileSync(path.resolve(argv[0]), "utf8"));
    const value = JSON.parse(fs.readFileSync(path.resolve(argv[1]), "utf8"));
    const errors = validateJsonSchemaSubset(schema, value);
    if (errors.length) {
      console.error("SCHEMA INVALID");
      for (const error of errors) console.error(` - ${error}`);
      return 2;
    }
    console.log(`SCHEMA OK ${value.schema ?? "unknown"}`);
    return 0;
  } catch (error) {
    console.error(`SCHEMA ERROR ${error.message}`);
    return 2;
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);
if (isMain) process.exit(main(process.argv.slice(2)));
