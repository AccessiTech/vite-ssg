import { UserConfig } from "vite";
export interface ViteServerProps extends UserConfig {
}
export interface ConfigProps {
    urlSrc: string;
    dest: string;
    staticPaths: string[];
    staticMetaData: string[];
    productionUrlBase: string;
    pathsBuilder: (items: any[]) => string[];
    viteServer: ViteServerProps;
    ssrEntry: string;
    replaceIndexHtml?: boolean;
}
export declare const CONFIG: ConfigProps;
export declare const defineConfig: (config: ConfigProps) => ConfigProps;
export declare function genUrls(config: ConfigProps): Promise<{
    config: ConfigProps;
    urls: string[];
}>;
export interface GenStaticProps {
    config: ConfigProps;
    urls: string[];
}
export declare function genStatic({ config, urls }: GenStaticProps): Promise<void>;
export declare const toBuildPath: (file: string, config: ConfigProps) => string;
export declare const generate: (config?: ConfigProps) => Promise<void>;
export default generate;
