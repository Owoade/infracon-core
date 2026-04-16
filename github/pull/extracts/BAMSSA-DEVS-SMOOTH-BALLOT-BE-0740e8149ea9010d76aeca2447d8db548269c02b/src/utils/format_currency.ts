export const format_currency= ( amount: number ) => new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
}).format(amount);

export const format_currency_without_symbol = ( amount: number ) => {
    return new Intl.NumberFormat('en-NG', {
        style: 'decimal',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,  
    }).format(amount);
}