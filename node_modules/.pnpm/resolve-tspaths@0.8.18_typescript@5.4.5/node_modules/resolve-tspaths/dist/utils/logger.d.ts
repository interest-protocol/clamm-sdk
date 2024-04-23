export type LoggerLevel = "verbose" | "info" | "error";
export declare class Logger {
    readonly level: LoggerLevel;
    constructor(level: LoggerLevel);
    verbose(...args: any[]): void;
    info(...args: any[]): void;
    error(...args: any[]): void;
    fancyParams<T extends {
        [key: string]: any;
    }>(title: string, params: T): void;
    fancyError(title: string, message: string): void;
}
