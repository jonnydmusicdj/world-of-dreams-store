/**
 * World of Dreams — AJAX add-to-cart on the single product page
 * with automatic Mini-Cart drawer opening (Tomorrowland style).
 *
 * Intercepts the product add-to-cart form, submits it via the WooCommerce
 * `wc-ajax=add_to_cart` endpoint (no page reload) and opens the Mini-Cart
 * drawer on success.
 *
 * @package Extendable
 */
(function ($) {
    'use strict';

    function openMiniCartDrawer() {
        var $button = $('.wc-block-mini-cart__button');
        if ($button.length) {
            $button.trigger('click');
        }
    }

    $(document.body).on('submit', 'form.cart', function (event) {
        var $form = $(this);

        // Do not intercept grouped or external product forms.
        if ($form.is('.grouped_form')) {
            return;
        }

        event.preventDefault();

        var data = $form.serialize();

        var url = (window.wc_add_to_cart_params && window.wc_add_to_cart_params.wc_ajax_url)
            ? window.wc_add_to_cart_params.wc_ajax_url.toString().replace('%%endpoint%%', 'add_to_cart')
            : window.location.origin + '/?wc-ajax=add_to_cart';

        $.post(url, data, function (response) {
            var fragments = (response && response.fragments) || {};
            var cartHash = (response && response.cart_hash) || '';

            $.each(fragments, function (key, value) {
                $(key).replaceWith(value);
            });

            if (cartHash && window.localStorage) {
                window.localStorage.setItem('wc_cart_hash', cartHash);
            }

            $(document.body).trigger('wc_fragment_refresh');
            $(document.body).trigger('added_to_cart', [fragments, cartHash, $form]);

            openMiniCartDrawer();
        }).fail(function () {
            // Fallback: normal page reload submit.
            $form.off('submit');
            $form.trigger('submit');
        });
    });
})(jQuery);
