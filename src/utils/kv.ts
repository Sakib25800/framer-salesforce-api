import { KVNamespace, KVNamespacePutOptions } from "@cloudflare/workers-types";
import * as v from "valibot";
import { APIError } from "./errors";

type KeyStructure<T extends string> = {
  pattern: T;
  params: ExtractParams<T>[];
};

type ExtractParams<T extends string> =
  T extends `${string}{${infer Param}}${infer Rest}`
    ? Param | ExtractParams<Rest>
    : never;

type KeyParams<T extends string> = Record<ExtractParams<T>, string>;

type KVConfig<TSchema extends v.GenericSchema, TKeyPattern extends string> = {
  schema: TSchema;
  key: KeyStructure<TKeyPattern>;
};

export class KV<TSchema extends v.GenericSchema, TKeyPattern extends string> {
  private kv: KVNamespace;
  private config: KVConfig<TSchema, TKeyPattern>;

  constructor(kv: KVNamespace, config: KVConfig<TSchema, TKeyPattern>) {
    this.kv = kv;
    this.config = config;
  }

  private buildKey(params: KeyParams<TKeyPattern>): string {
    return (Object.entries(params) as [string, string][]).reduce<string>(
      (key, [param, value]) => key.split(`{${param}}`).join(value),
      this.config.key.pattern,
    );
  }

  async get(
    params: KeyParams<TKeyPattern>,
  ): Promise<v.InferOutput<TSchema> | null> {
    const key = this.buildKey(params);
    const data = await this.kv.get(key);

    if (data === null) return null;

    const parsedData = typeof data === "string" ? JSON.parse(data) : data;
    return v.parse(this.config.schema, parsedData);
  }

  async getOrThrow(
    params: KeyParams<TKeyPattern>,
    errorMessage = "Data not found",
  ): Promise<v.InferOutput<TSchema>> {
    const data = await this.get(params);
    if (data === null) {
      throw new APIError(errorMessage);
    }

    return data;
  }

  async getOrCreate(
    params: KeyParams<TKeyPattern>,
    value: v.InferOutput<TSchema>,
    options?: KVNamespacePutOptions,
  ): Promise<v.InferOutput<TSchema>> {
    const data = await this.get(params);
    if (data !== null) {
      return data;
    }

    await this.put(params, value, options);
    return value;
  }

  async put(
    params: KeyParams<TKeyPattern>,
    value: v.InferOutput<TSchema>,
    options?: KVNamespacePutOptions,
  ): Promise<void> {
    const key = this.buildKey(params);
    const output = v.parse(this.config.schema, value);
    await this.kv.put(key, JSON.stringify(output), options);
  }

  async listKeys(params: KeyParams<TKeyPattern>): Promise<string[]> {
    const prefix = this.buildKey(params);
    const listResponse = await this.kv.list({ prefix });
    return listResponse.keys.map((key) => key.name);
  }

  async delete(params: KeyParams<TKeyPattern>): Promise<void> {
    const key = this.buildKey(params);
    await this.kv.delete(key);
  }
}
