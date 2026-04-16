export function capitalize_first_letter(input: string): string {

    if (!input || input?.length === 0) {
        return input; // Return the input string unchanged if it's empty
    }

    // Capitalize the first letter and concatenate with the rest of the string
    return input.charAt(0).toUpperCase() + input.slice(1);

}