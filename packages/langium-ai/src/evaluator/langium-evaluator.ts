/**
 * Base Langium DSL validator (taps into Langium's validator messages to provide better results)
 */

import { LangiumServices } from "langium/lsp";
import { Evaluator, EvaluatorResult, EvaluatorResultData } from "./evaluator.js";
import { URI } from "langium";

export interface LangiumEvaluatorResultData extends EvaluatorResultData {
    failures: number;
    errors: number;
    warnings: number;
    infos: number;
    hints: number;
    unassigned: number;
    response_length: number;
}

export class LangiumEvaluator extends Evaluator {

    /**
     * Services to use for evaluation
     */
    protected services: LangiumServices;

    constructor(services: LangiumServices) {
        super();
        this.services = services;
    }

    /**
     * Validate an agent response as if it's a langium program. If we can parse it, we attempt to validate it.
     */
    async evaluate(response: string): Promise<Partial<EvaluatorResult>> {

        if (response.includes('```')) {
            // take the first code block instead, if present (assuming it's a langium grammar)
            const codeBlock = response.split(/```[a-z-]*/)[1];
            response = codeBlock;
        }

        const doc = this.services.shared.workspace.LangiumDocumentFactory.fromString(response, URI.parse('memory://test.langium'));

        try {
            await this.services.shared.workspace.DocumentBuilder.build([doc], { validation: true });
            const validationResult = doc.diagnostics ?? [];
            
            // sum severity score, lower is better
            let evalData: LangiumEvaluatorResultData = {
                failures: 0,
                errors: 0,
                warnings: 0,
                infos: 0,
                hints: 0,
                unassigned: 0,
                response_length: response.length
            };

            for (const diagnostic of validationResult) {
                if (diagnostic.severity) {
                    switch (diagnostic.severity) {
                        case 1:
                            evalData.errors++;
                            break;
                        case 2:
                            evalData.warnings++;
                            break;
                        case 3:
                            evalData.infos++;
                            break;
                        case 4:
                            evalData.hints++;
                            break;
                        default:
                            evalData.unassigned++;
                            break;
                    }
                }
            }

            return {
                data: evalData
            };

        } catch (e) {
            console.error('Error during evaluation: ', e);
            return {
                data: {
                    failures: 1,
                    errors: 0,
                    warnings: 0,
                    infos: 0,
                    hints: 0,
                    unassigned: 0,
                    response_length: response.length
                } as LangiumEvaluatorResultData
            };
        }
    }
}