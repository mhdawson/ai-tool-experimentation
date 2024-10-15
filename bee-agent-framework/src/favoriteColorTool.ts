import {
  StringToolOutput,
  Tool,
  ToolInput,
  ToolInputValidationError,
} from "bee-agent-framework/tools/base";
import { z } from "zod";

export class FavoriteColorTool extends Tool<StringToolOutput> {
  name = 'Favorite Color';
  description = 'returns the favorite color for person given their City and Country';

  inputSchema() {
    return z.object({
      city: z
       .string()
       .min(0)
       .describe(
         `the city for the person`,
        ),
      country: z
        .string()
        .min(0)
        .describe(
          `the country for the person`,
         )
    });
  }


  static {
    // Makes the class serializable
    this.register();
  }

  protected async _run(input: ToolInput<this>): Promise<StringToolOutput> {
    const city = input.city;
    const country = input.country;
    if ((city === 'Ottawa') && (country === 'Canada')) {
      return new StringToolOutput('the favoriteColorTool returned that the favorite color for Ottawa Canada is black');
    } else if ((city === 'Montreal') && (country === 'Canada')) {
      return new StringToolOutput('the favoriteColorTool returned that the favorite color for Montreal Canada is red');
    } else {
      //throw new ToolInputValidationError(`the favoriteColorTool returned The city or country
      return new StringToolOutput(`the favoriteColorTool returned The city or country
        was not valid, please ask the user for them`);
    }
  }
};
