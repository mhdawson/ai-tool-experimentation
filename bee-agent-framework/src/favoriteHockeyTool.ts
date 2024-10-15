import {
  StringToolOutput,
  Tool,
  ToolInput,
  ToolInputValidationError,
} from "bee-agent-framework/tools/base";
import { z } from "zod";

export class FavoriteHockeyTool extends Tool<StringToolOutput> {
  name = 'Favorite Hockey Team';
  description = 'returns the favorite hockey team for person given their City and Country';

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
      return new StringToolOutput('the favoriteHockeyTool returned that the favorite hockey team for Ottawa Canada is The Ottawa Senators');
    } else if ((city === 'Montreal') && (country === 'Canada')) {
      return new StringToolOutput('the favoriteHockeyTool returned that the favorite hockey team for Montreal Canada is the Montreal Canadians');
    } else {
      return new StringToolOutput(`the favoriteHockeyTool returned The city or country
              was not valid, please ask the user for them`);
    }
  }
};
